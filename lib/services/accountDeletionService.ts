import { api } from "@/lib/apiClient";

class AccountDeletionService {
  async deleteMyAccount(): Promise<void> {
    await api.delete("/api/user/me");
  }
}

export const accountDeletionService = new AccountDeletionService();
export default accountDeletionService;
