import { CreateUsernameResponse, GraphQLContext } from "../../util/types";
import { ApolloError } from "apollo-server-core";
import { User } from "@prisma/client";
import { calculateDistance } from "../../util/functions";
const { GraphQLUpload } = require("graphql-upload");
import fs from "fs";
import path from "path";
import { env } from "process";

const resolvers = {
  Upload: GraphQLUpload,
  Query: {
    getUser: async (_: any, args: { id: string }, context: GraphQLContext) => {
      const { id } = args;
      const { session, prisma } = context;
      if (!session?.user) {
        throw new ApolloError("Not Authorized");
      }
      try {
        const user = await prisma.user.findUnique({
          where: {
            id,
          },
        });
        return user;
      } catch (error: any) {
        console.log("Get user error", error);
        throw new ApolloError(error?.message);
      }
    },

    searchUsers: async (
      _: any,
      args: { username: string },
      context: GraphQLContext
    ): Promise<Array<User>> => {
      const { username } = args;
      const { session, prisma } = context;
      // if (!session?.user) {
      //   throw new ApolloError("Not Authorized");
      // }
      const myUsername = session?.user.username;

      try {
        const users = await prisma.user.findMany({
          where: {
            username: {
              contains: username,
              not: myUsername,
              mode: "insensitive",
            },
          },
        });
        return users;
      } catch (error: any) {
        console.log("Search for users error", error);
        throw new ApolloError(error?.message);
      }
    },
    searchNearUsers: async (
      _: any,
      args: { latitude: number; longitude: number },
      context: GraphQLContext
    ): Promise<Array<User>> => {
      const { session, prisma } = context;
      if (!session?.user) {
        throw new ApolloError("Not Authorized");
      }
      const { latitude, longitude } = args;
      const {
        user: { username: myUsername },
      } = session;
      try {
        const nearUsers = await prisma.user.findMany({
          where: {
            username: {
              not: myUsername,
            },
          },
        });

        const filteredUsers = nearUsers.filter((user) => {
          const distance = calculateDistance(
            user?.latitude as any,
            user?.longitude as any,
            latitude,
            longitude
          );
          return distance < 100; // user radius in km self explanatory u dumb fuck
        });

        return filteredUsers;
      } catch (e: any) {
        //console.log("Search for near users error", e);
        throw new ApolloError(e?.message);
      }
    },
  },
  Mutation: {
    createUsername: async (
      _: any,
      args: { username: string },
      context: GraphQLContext
    ): Promise<CreateUsernameResponse> => {
      const { username } = args;
      const { session, prisma } = context;
      //console.log("in createUsername resolver");
      if (!session?.user) {
        return { error: "Not Authorized", success: false };
      }
      const { id: userId } = session.user;
      try {
        // check if username not already taken
        const existingUser = await prisma.user.findUnique({
          where: { username },
        });
        if (existingUser) {
          return { error: "Username already taken", success: false };
        }

        // update user
        await prisma.user.update({
          where: { id: userId },
          data: { username },
        });
        return { success: true };
      } catch (error: any) {
        console.log(error);
        return { error: error?.message, success: false };
      }
    },
    updateUserInformation: async (
      _: any,
      args: { username: string; imageUrl: string; bio: string },
      context: GraphQLContext
    ): Promise<any> => {
      const { username, imageUrl, bio } = args;
      const { session, prisma } = context;
      console.log("in updateUserInformation resolver");
      if (!session?.user) {
        return { error: "Not Authorized", success: false };
      }
      const { id: userId } = session.user;
      try {
        // check if username not already taken
        const existingUser = await prisma.user.findFirst({
          where: { username },
        });
        if (existingUser && existingUser?.id !== userId) {
          return { error: "Username already taken", success: false };
        }

        // update user
        // console.log("image", imageUrl);
        //console.log("username", username);
        await prisma.user.update({
          where: { id: userId },
          data: { username, imageUrl, bio },
        });
        return { success: true };
      } catch (error: any) {
        console.log(error);
        return { error: error?.message, success: false };
      }
    },
    setLocation: async (
      _: any,
      args: { latitude: number; longitude: number },
      context: GraphQLContext
    ): Promise<any> => {
      console.log("in setLocation resolver");
      const { latitude, longitude } = args;
      const { session, prisma } = context;
      if (!session?.user) {
        return { error: "Not Authorized", success: false };
      }
      if (!latitude || !longitude) {
        return { error: "Invalid location", success: false };
      }
      const { id: userId } = session.user;
      try {
        const res = await prisma.user.update({
          where: { id: userId },
          data: { latitude, longitude },
        });
        console.log("res", res);
      } catch (error: any) {
        console.log(error);
        return { error: error?.message, success: false };
      }
      return { success: true };
    },

    uploadFile: async function (
      _: any,
      { file, fileName }: any,
      context: GraphQLContext
    ) {
      console.log("in uploadFile resolver file name", fileName);
      const { session, prisma } = context;
      if (!session?.user) {
        throw new ApolloError("Not Authorized");
      }
      const { id: userId } = session.user;
      const { createReadStream, mimetype, encoding } = await file;
      const stream = createReadStream();
      const pathName = path.join(
        __dirname,
        `../../../public/images/${fileName}.png`
      );
      // console.log("pathName", pathName);
      try {
        const res = new Promise((resolve, reject) =>
          stream
            .on("error", (error: any) => {
              if (stream.truncated)
                // delete the truncated file
                fs.unlinkSync(pathName);
              reject(error);
            })
            .pipe(fs.createWriteStream(pathName))
            .on("error", (error: any) => reject(error))
            .on("finish", () => resolve({ pathName }))
        );
        return { url: process.env.SERVER_URL + "/images/" + userId + ".png" };
      } catch (error: any) {
        console.log(error);
        throw new ApolloError(error?.message);
      }
    },
  },
};

export default resolvers;
