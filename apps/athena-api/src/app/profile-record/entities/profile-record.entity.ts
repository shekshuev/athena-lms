import { ALL_PROFILE_RECORD_TYPES, ProfileRecordType } from "@athena-lms/shared";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

import { Account } from "../../account";

/**
 * @Entity ProfileRecord
 * Dynamic key-value storage for user profile data.
 * Allows adding arbitrary fields without schema migrations.
 */
@Entity("profile_records")
@Index(["account", "name"], { unique: true })
export class ProfileRecord {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  /**
   * Associated account.
   */
  @ManyToOne(() => Account, account => account.profileRecords, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "account_id" })
  account!: Account;

  /**
   * Name of the field (e.g. "first_name", "city", "degree").
   */
  @Column()
  name!: string;

  /**
   * Stringified value (text, number, date as string).
   */
  @Column("text")
  value!: string;

  /**
   * Optional data type for better client-side parsing.
   */
  @Column({
    name: "data_type",
    type: "enum",
    enum: ALL_PROFILE_RECORD_TYPES,
    default: ProfileRecordType.String,
  })
  dataType!: ProfileRecordType;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
