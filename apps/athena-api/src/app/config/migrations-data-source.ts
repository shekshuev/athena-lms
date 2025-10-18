import { join } from "path";

import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

const options = {
  type: "postgres",
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || "5432", 10),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: ["**/*.entity{.ts,.js}"],
  migrations: [join(__dirname, "migrations", "*{.ts,.js}")],
} satisfies TypeOrmModuleOptions;

export default new DataSource(options);
