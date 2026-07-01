import type { UserAccount } from "../apis/sprix";
import type { Account } from "../types";
import { http } from "../utils/http";

export async function uploadRemoteAccountAvatar(file: File): Promise<Partial<Account>> {
  const formData = new FormData();
  formData.append("file", file);
  const account = await http.post<unknown, UserAccount>("/api/v1/account/profile/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return { avatarUrl: account.avatarUrl ?? "" };
}
