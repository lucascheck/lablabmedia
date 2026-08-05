import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createUserAsAdmin, deleteUserAsAdmin } from "@/lib/admin-users.server";

const createUserInput = z.object({
  accessToken: z.string(),
  email: z.string().email(),
  password: z.string().min(6),
});

export const createUser = createServerFn({ method: "POST" })
  .inputValidator(createUserInput)
  .handler(async ({ data }) => createUserAsAdmin(data));

const deleteUserInput = z.object({
  accessToken: z.string(),
  userId: z.string(),
});

export const deleteUser = createServerFn({ method: "POST" })
  .inputValidator(deleteUserInput)
  .handler(async ({ data }) => deleteUserAsAdmin(data));
