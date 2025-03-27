CREATE EXTENSION IF NOT EXISTS "vector";


CREATE TABLE "account" (
	"userId" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "authenticator" (
	"credentialID" text NOT NULL,
	"userId" uuid NOT NULL,
	"providerAccountId" text NOT NULL,
	"credentialPublicKey" text NOT NULL,
	"counter" integer NOT NULL,
	"credentialDeviceType" text NOT NULL,
	"credentialBackedUp" boolean NOT NULL,
	"transports" text,
	CONSTRAINT "authenticator_credentialID_unique" UNIQUE("credentialID")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) NOT NULL,
	"title" text,
	"summary" text,
	"content" text,
	"datetime" timestamp (3),
	"embedding" halfvec(3072),
	"user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "conversations_to_serendipitous_paths" (
	"conversation_id" uuid NOT NULL,
	"serendipitous_path_id" uuid NOT NULL,
	CONSTRAINT "conversations_to_serendipitous_paths_conversation_id_serendipitous_path_id_pk" PRIMARY KEY("conversation_id","serendipitous_path_id")
);
--> statement-breakpoint
CREATE TABLE "conversations_to_user_paths" (
	"conversation_id" uuid NOT NULL,
	"user_path_id" uuid NOT NULL,
	CONSTRAINT "conversations_to_user_paths_conversation_id_user_path_id_pk" PRIMARY KEY("conversation_id","user_path_id")
);
--> statement-breakpoint
CREATE TABLE "path_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) NOT NULL,
	"score" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"path_id" uuid NOT NULL,
	CONSTRAINT "path_feedback_user_id_path_id_key" UNIQUE("user_id","path_id")
);
--> statement-breakpoint
CREATE TABLE "serendipitous_paths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) NOT NULL,
	"title" text NOT NULL,
	"common_summary" text NOT NULL,
	"category" text NOT NULL,
	"balance_score" double precision NOT NULL,
	"is_sensitive" boolean DEFAULT false NOT NULL,
	"users_match_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_paths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) NOT NULL,
	"unique_summary" text NOT NULL,
	"unique_call_to_action" text NOT NULL,
	"user_id" uuid NOT NULL,
	"path_id" uuid NOT NULL,
	CONSTRAINT "user_paths_user_id_path_id_key" UNIQUE("user_id","path_id")
);
--> statement-breakpoint
CREATE TABLE "users_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) NOT NULL,
	"score" double precision NOT NULL,
	"viewed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"country" text DEFAULT 'INTERNET' NOT NULL,
	"sensitive_matching" boolean DEFAULT false NOT NULL,
	"extension_api_key" varchar(32) DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"email" text,
	"emailVerified" timestamp,
	"image" text,
	CONSTRAINT "users_name_unique" UNIQUE("name"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "users_to_users_matches" (
	"user_id" uuid NOT NULL,
	"users_match_id" uuid NOT NULL,
	CONSTRAINT "users_to_users_matches_user_id_users_match_id_pk" PRIMARY KEY("user_id","users_match_id")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authenticator" ADD CONSTRAINT "authenticator_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "conversations_to_serendipitous_paths" ADD CONSTRAINT "conversations_to_serendipitous_paths_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "conversations_to_serendipitous_paths" ADD CONSTRAINT "conversations_to_serendipitous_paths_serendipitous_path_id_serendipitous_paths_id_fk" FOREIGN KEY ("serendipitous_path_id") REFERENCES "public"."serendipitous_paths"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "conversations_to_user_paths" ADD CONSTRAINT "conversations_to_user_paths_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "conversations_to_user_paths" ADD CONSTRAINT "conversations_to_user_paths_user_path_id_user_paths_id_fk" FOREIGN KEY ("user_path_id") REFERENCES "public"."user_paths"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "path_feedback" ADD CONSTRAINT "path_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "path_feedback" ADD CONSTRAINT "path_feedback_path_id_serendipitous_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."serendipitous_paths"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "serendipitous_paths" ADD CONSTRAINT "serendipitous_paths_users_match_id_users_matches_id_fk" FOREIGN KEY ("users_match_id") REFERENCES "public"."users_matches"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_paths" ADD CONSTRAINT "user_paths_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_paths" ADD CONSTRAINT "user_paths_path_id_serendipitous_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."serendipitous_paths"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "users_to_users_matches" ADD CONSTRAINT "users_to_users_matches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "users_to_users_matches" ADD CONSTRAINT "users_to_users_matches_users_match_id_users_matches_id_fk" FOREIGN KEY ("users_match_id") REFERENCES "public"."users_matches"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "embedding_index" ON "conversations" USING hnsw ("embedding" halfvec_cosine_ops);--> statement-breakpoint
CREATE INDEX "conversation_user_id_idx" ON "conversations" USING btree ("user_id");