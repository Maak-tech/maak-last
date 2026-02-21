import { httpsCallable } from "firebase/functions";
import { functions as firebaseFunctions } from "@/lib/firebase";

class AccountDeletionService {
  async deleteMyAccount(): Promise<void> {
    const deleteAccount = httpsCallable<
      Record<string, never>,
      { success?: boolean }
    >(firebaseFunctions, "deleteAccount");
    await deleteAccount({});
  }
}

export const accountDeletionService = new AccountDeletionService();
export default accountDeletionService;
