import { gql } from "apollo-server-core";

const typeDefs = gql`
  scalar Upload
  # searchedUser type
  type User {
    id: String
    username: String
    longitude: Float
    latitude: Float
    imageUrl: String
  }

  type UserProfile {
    id: String
    username: String
    bio: String
    imageUrl: String
    points: Int
    longitude: Float
    latitude: Float
  }

  type File {
    url: String!
  }

  type Query {
    searchUsers(username: String): [User]
    searchNearUsers(latitude: Float, longitude: Float): [User]
    getUser(id: String): UserProfile
  }

  type Mutation {
    createUsername(username: String): CreateUsernameResponse
    setLocation(latitude: Float, longitude: Float): CreateUsernameResponse
    updateUserInformation(
      username: String
      bio: String
      imageUrl: String
    ): CreateUsernameResponse
    uploadFile(file: Upload!, fileName: String!): File!
  }

  type CreateUsernameResponse {
    success: Boolean
    error: String
  }
`;

export default typeDefs;
