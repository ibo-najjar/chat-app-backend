import { GraphQLContext } from "../../util/types";
import { ApolloError } from "apollo-server-core";
import { Prisma } from "@prisma/client";
import { withFilter } from "graphql-subscriptions";
import { calculateDistance } from "../../util/functions";

const resolvers = {
  Query: {
    getGroupConversations: async (_: any, __: any, context: GraphQLContext) => {
      const { session, prisma } = context;
      if (!session?.user) {
        throw new ApolloError("Not authenticated");
      }

      try {
        // include count of participants in the return object

        // get all group conversations
        const conversations = await prisma.conversation.findMany({
          where: {
            adminId: {
              not: null,
            },
          },
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                  },
                },
              },
            },
          },
        });

        // calculate distance between user and group AND Return distance in km
        const conversationsWithDistance = conversations.map((conversation) => {
          const numberOfParticipants = conversation.participants.length;
          const distance = calculateDistance(
            session?.user?.latitude,
            session?.user?.longitude,
            conversation.lat as number,
            conversation.lng as number
          );

          return {
            ...conversation,
            distance,
            numberOfParticipants,
          };
        });
        return conversationsWithDistance;
      } catch (error) {
        console.log("getGroupConversations resolver error", error);
        throw new ApolloError("Error getting group conversations");
      }
    },
    getConversations: async (
      _: any,
      __: any,
      context: GraphQLContext
    ): Promise<any> => {
      const { session, prisma } = context;
      // if (!session?.user) {
      //   throw new ApolloError("Not authenticated");
      // }
      const userId = session?.user?.id;

      try {
        const conversations = await prisma.conversation.findMany({
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true, // add lng and lat lng
                    imageUrl: true,
                  },
                },
              },
            },

            latestMessage: {
              include: {
                sender: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
              },
            },
          },
        });

        return conversations.filter((conversation) =>
          conversation.participants.some(
            (participant) => participant.userId === userId
          )
        );
      } catch (error) {
        console.log("getConversations resolver error", error);
        throw new ApolloError("Error getting conversations");
      }
    },
    conversation: async (
      _: any,
      args: { conversationId: string },
      context: GraphQLContext
    ): Promise<any> => {
      const { session, prisma } = context;
      const { conversationId } = args;
      if (!session?.user) {
        throw new ApolloError("Not authenticated");
      }
      const { id: userId } = session.user;

      try {
        const conversation = await prisma.conversation.findUnique({
          where: {
            id: conversationId,
          },

          include: {
            participants: {
              where: {
                userId: {
                  not: userId,
                },
              },
              include: {
                user: {
                  select: {
                    id: true,
                    username: true, // add lng and lat lng
                    imageUrl: true,
                    latitude: true,
                    longitude: true,
                  },
                },
              },
            },
          },
        });

        if (!conversation) {
          throw new ApolloError("Conversation not found");
        }
        return conversation;
      } catch (error) {
        console.log("conversation resolver error", error);
        throw new ApolloError("Error getting conversation");
      }
    },
  },
  Mutation: {
    joinGroupConversation: async (
      _: any,
      args: { conversationId: string },
      context: GraphQLContext
    ) => {
      const { session, prisma } = context;
      const { conversationId } = args;
      if (!session?.user) {
        throw new ApolloError("Not authenticated");
      }
      const { id: userId } = session.user;

      try {
        const conversation = await prisma.conversation.findUnique({
          where: {
            id: conversationId,
          },
        });

        if (!conversation) {
          throw new ApolloError("Conversation not found");
        }

        const participant = await prisma.conversationParticipant.findFirst({
          where: {
            conversationId,
            userId,
          },
        });

        if (participant) {
          return conversationId;
        }

        const newParticipant = await prisma.conversationParticipant.create({
          data: {
            conversationId,
            userId,
          },
        });

        console.log("newParticipant", newParticipant);

        return conversationId;
      } catch (error) {
        console.log("joinGroupConversation resolver error", error);
        throw new ApolloError("Error joining conversation");
      }
    },
    createConversation: async (
      _: any,
      args: { participantIds: Array<string> },
      context: GraphQLContext
    ): Promise<{ conversationId: string }> => {
      console.log("createConversation resolver called");
      console.log(args);
      const { session, prisma, pubsub } = context;
      const { participantIds } = args;
      console.log("participantIds", participantIds);
      if (!session?.user) {
        throw new ApolloError("Not authenticated");
      }
      const { user: userId } = session;
      // check if conversation already exists
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          participants: {
            every: {
              userId: {
                in: participantIds,
              },
            },
          },
        },
      });
      if (existingConversation) {
        return { conversationId: existingConversation.id };
      }

      try {
        const conversation = await prisma.conversation.create({
          data: {
            participants: {
              createMany: {
                data: participantIds?.map((id) => ({
                  userId: id,
                  hasSeenLatest: id === userId.toString(),
                })),
              },
            },
          },
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true, // add lng and lat lng
                  },
                },
              },
            },
            latestMessage: {
              include: {
                sender: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
              },
            },
          },
        });

        // pubsub
        pubsub.publish("CONVERSATION_CREATED", {
          conversationCreated: conversation,
        });

        return { conversationId: conversation.id };
      } catch (error) {
        console.log("createConversation resolver error", error);
        throw new ApolloError("Error creating conversation");
      }
    },
    createGroupConversation: async (
      _: any,
      args: {
        name: string;
        bio: string;
        lng: number;
        lat: number;
        groupRadius: number;
        adminId: string;
      },
      context: GraphQLContext
    ) => {
      console.log("args", args);
      const { session, prisma, pubsub } = context;
      if (!session?.user) {
        throw new ApolloError("Not authenticated");
      }
      const { user: userId } = session;
      const { name, bio, lng, lat, groupRadius } = args;

      try {
        const conversation = await prisma.conversation.create({
          data: {
            name,
            bio,
            lng,
            lat,
            groupRadius,
            admin: {
              connect: {
                id: userId.id,
              },
            },
            participants: {
              create: {
                userId: userId.id,
              },
            },
          },
        });
        console.log("conversation", conversation);
        return { conversationId: conversation.id };
      } catch (error) {
        console.log("createGroupConversation resolver error", error);
        throw new ApolloError("Error creating group conversation");
      }
    },
  },

  Subscription: {
    conversationCreated: {
      subscribe: withFilter(
        (_: any, __: any, context: GraphQLContext) => {
          const { pubsub } = context;
          return pubsub.asyncIterator(["CONVERSATION_CREATED"]);
        },
        (payload: any, _: any, context: GraphQLContext): any => {
          const { session } = context;
          const {
            conversationCreated: { participants },
          } = payload;

          const userIsParticipant = !!participants.find(
            (p: any) => p.userId === session?.user?.id
          );
          return userIsParticipant;
        }
      ),
    },
  },
};

export default resolvers;
