import "reflect-metadata";
import { MikroORM } from "@mikro-orm/core";
import { __prod__ } from "./constants";
import microConfig from "./mikro-orm.config";
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import redis from "redis";
import session from "express-session";
import connectRedis from "connect-redis";
import { MyContext } from "./types";
import cors from "cors";
import SECRET_KEY from "./secrets";

const main = async () => {
  const orm = await MikroORM.init(microConfig);
  await orm.getMigrator().up();

  const app = express();

  const RedisStore = connectRedis(session);
  const redisClient = redis.createClient();

  app.use(
    cors({
      origin: "http://localhost:3000",
      credentials: true,
    })
  );
  app.use(
    session({
      name: "qid",
      store: new RedisStore({
        client: redisClient,
        disableTouch: true,
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 14,
        httpOnly: true,
        sameSite: "lax", //csrf
        secure: __prod__, // TODO: cookie only works in https if true
      },
      // TODO: env variable for secret key
      secret: SECRET_KEY,
      resave: false,
      saveUninitialized: false,
    })
  );

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }): MyContext => ({ em: orm.em, req, res }),
  });

  apolloServer.applyMiddleware({
    app,
    cors: false,
  });

  const portListen = app.listen(4000, () => {
    console.log("server started on http://localhost:4000");
  });

  portListen.on("error", (err) => {
    console.error("app error", err.stack);
  });
  //   const post = orm.em.create(Post, { title: "my second post" });
  //   await orm.em.persistAndFlush(post);
  //   const posts = await orm.em.find(Post, {});
  //   console.log(posts);
};

main().catch((err) => {
  console.error(err);
});
