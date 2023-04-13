import { Prisma, PrismaClient } from "@prisma/client";
import { ISODateString } from "next-auth";
import { Context } from "graphql-ws/lib/server";
import { PubSub } from "graphql-subscriptions";
import { messagePopulated } from "../graphql/resolvers/messages";

// server config

export interface GraphQLContext {
  session: Session | null;
  prisma: PrismaClient;
  pubsub: PubSub;
}

export interface Session {
  user: User;
  expires: ISODateString;
}

export interface SubscriptionContext extends Context {
  connectionParams: {
    session?: Session;
  };
}

export interface User {
  id: string;
  username: string;
  image: string;
  email: string;
  name: string;
  latitude: number;
  longitude: number;
}

// Users
export interface CreateUsernameResponse {
  success?: boolean;
  error?: string;
}

// Messages

export interface sendMessageAruments {
  id: string;
  conversationId: string;
  senderId: string;
  imageUrl: string | null;
  body: string;
}

export interface MessageSentSubscriptionPayload {
  messageSent: MessagePopulated;
}

export type MessagePopulated = Prisma.MessageGetPayload<{
  include: typeof messagePopulated;
}>;
