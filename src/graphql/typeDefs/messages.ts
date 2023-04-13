import { gql } from "apollo-server-core";

const typeDefs = gql`
  scalar Date

  type Message {
    id: String
    sender: User
    body: String
    createdAt: Date
  }

  type Query {
    messages(conversationId: String): [Message]
  }

  type Mutation {
    sendMessage(
      id: String
      conversationId: String
      senderId: String
      body: String
      imageUrl: String
    ): Boolean
  }

  type Subscription {
    # fires when a new message is sent and returns the message
    messageSent(conversationId: String): Message
  }
`;

export default typeDefs;
