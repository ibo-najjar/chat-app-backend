import { Prisma } from "@prisma/client";
import { GraphQLError } from "graphql";
import { withFilter } from "graphql-subscriptions";
import { userIsConversationParticipant } from "../../util/functions";
import {
  GraphQLContext,
  MessagePopulated,
  MessageSentSubscriptionPayload,
  sendMessageAruments,
} from "../../util/types";

const resolvers = {
  Query: {
    messages: async function (
      _: any,
      args: { conversationId: string },
      context: GraphQLContext
    ): Promise<Array<MessagePopulated>> {
      console.log("messages resolver");
      const { session, prisma } = context;
      const { conversationId } = args;
      if (!session?.user) {
        throw new GraphQLError("You must be logged in to view messages");
      }
      // stop other participants from obtaining url and send messages in chats they are not in
      const {
        user: { id: userId },
      } = session;

      const conversation = await prisma.conversation.findUnique({
        where: {
          id: conversationId,
        },
        include: {
          participants: true,
        },
      });

      if (!conversation) {
        throw new GraphQLError("Conversation not found");
      }

      //console.log("conversation particpants: ", conversation.participants);
      const allowedToView = userIsConversationParticipant(
        conversation.participants,
        userId
      );

      if (!allowedToView) {
        throw new GraphQLError("You are not allowed to view this conversation");
      }

      try {
        const messages = await prisma.message.findMany({
          where: {
            conversationId,
          },
          include: messagePopulated,
          orderBy: {
            createdAt: "desc",
          },
        });

        return messages;
      } catch (error: any) {
        console.log("messages error: ", error);
        throw new GraphQLError("error getting messages");
      }
    },
  },
  Mutation: {
    sendMessage: async function (
      _: any,
      args: sendMessageAruments,
      context: GraphQLContext
    ): Promise<boolean> {
      const { session, prisma, pubsub } = context;
      if (!session?.user) {
        throw new GraphQLError("You must be logged in to send messages");
      }

      const { id: userId } = session.user;
      const { id: messageId, conversationId, senderId, body } = args;

      if (userId !== senderId) {
        throw new GraphQLError("You can only send messages as yourself");
      }

      try {
        // create new message
        const newMessage = await prisma.message.create({
          data: {
            id: messageId,
            body,
            senderId,
            conversationId,
          },
          include: messagePopulated,
        });

        // find conversation participant entitiy

        const participant = await prisma.conversationParticipant.findFirst({
          where: {
            userId,
            conversationId,
          },
        });

        if (!participant) {
          throw new GraphQLError(
            "You are not a participant in this conversation"
          );
        }

        // update conversation
        const conversation = await prisma.conversation.update({
          where: {
            id: conversationId,
          },
          data: {
            latestMessageId: newMessage.id,
            participants: {
              update: {
                where: {
                  id: participant.id,
                },
                data: {
                  hasSeenLatest: true,
                },
              },
              updateMany: {
                where: {
                  NOT: {
                    userId,
                  },
                },
                data: {
                  hasSeenLatest: false,
                },
              },
            },
          },
          include: {
            participants: true,
          },
        });

        pubsub.publish("MESSAGE_SENT", {
          messageSent: newMessage,
        });
        // pubsub.publish("CONVERSATION_UPDATED", {
        //   conversationUpdated: conversation,
        // });
      } catch (error: any) {
        console.log("sendMessage error: ", error);
        throw new GraphQLError("error sending message");
      }

      return true;
    },
  },
  Subscription: {
    messageSent: {
      subscribe: withFilter(
        (_: any, __: any, context: GraphQLContext) => {
          const { pubsub } = context;
          return pubsub.asyncIterator(["MESSAGE_SENT"]);
        },
        (
          payload: MessageSentSubscriptionPayload,
          args: { conversationId: string },
          context: GraphQLContext
        ) => {
          return payload.messageSent.conversationId === args.conversationId;
        }
      ),
    },
  },
};

export const messagePopulated = Prisma.validator<Prisma.MessageInclude>()({
  sender: {
    select: {
      id: true,
      username: true,
      imageUrl: true,
    },
  },
});

export default resolvers;
