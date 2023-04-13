import { gql } from "apollo-server-core";

const typeDefs = gql`
  scalar Date

  type Mutation {
    createConversation(participantIds: [String]): CreateConversationResponse
    createGroupConversation(
      name: String
      adminId: String
      bio: String
      groupRadius: Int
      lng: Float
      lat: Float
    ): CreateConversationResponse
    joinGroupConversation(conversationId: String): CreateConversationResponse
  }
  type CreateConversationResponse {
    conversationId: String
  }
  type Conversation {
    id: String
    latestMessage: Message
    participants: [Participant]
    createdAt: Date
    updatedAt: Date
    bio: String
    groupRadius: Int
    longitude: Float
    latitude: Float
    adminId: String
    name: String
  }
  type GroupConversation {
    id: String
    latestMessage: Message
    participants: [Participant]
    createdAt: Date
    updatedAt: Date
    name: String
    bio: String
    groupRadius: Int
    longitude: Float
    latitude: Float
    adminId: String
    distance: Float
    numberOfParticipants: Int
  }

  type Participant {
    id: String
    user: User
    hasSeenLatest: Boolean
    imageUrl: String
    latitude: String
    longitude: String
  }

  type Query {
    getConversations: [Conversation]
    conversation(conversationId: String): Conversation
    getGroupConversations: [GroupConversation]
  }

  type Subscription {
    conversationCreated: Conversation
  }
`;

export default typeDefs;
