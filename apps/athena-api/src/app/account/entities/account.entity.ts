import { AccountRole, ALL_ACCOUNT_ROLES } from "@athena-lms/shared";
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

import { ProfileRecord } from "../../profile-record";

/**
 * @Entity Account
 * Represents a system account for authentication and access control.
 * Personal data is stored as dynamic key-value records (ProfileRecord).
 */
@Entity("accounts")
export class Account {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  /**
   * Unique login for authentication.
   */
  @Column({ unique: true })
  login!: string;

  /**
   * Hashed password.
   * Never expose or return this field in DTOs.
   */
  @Column({ name: "password_hash" })
  passwordHash!: string;

  /**
   * System role.
   */
  @Column({
    type: "enum",
    enum: ALL_ACCOUNT_ROLES,
    default: AccountRole.Student,
  })
  role!: AccountRole;

  /**
   * Account active status (used for bans/suspensions).
   */
  @Column({ default: true })
  isActive!: boolean;

  /**
   * One-to-many relationship to profile records.
   */
  @OneToMany(() => ProfileRecord, record => record.account, {
    cascade: true,
  })
  profileRecords!: ProfileRecord[];

  /**
   * Timestamps.
   */
  @CreateDateColumn({ name: "created_at" })
  readonly createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  readonly updatedAt!: Date;

  @DeleteDateColumn({ name: "deleted_at" })
  deletedAt!: Date | null;
}
