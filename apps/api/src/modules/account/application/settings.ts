import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { MachineRepository } from "~/modules/machines/infrastructure/MachineRepository";
import { validatePetSettingsUpdate } from "~/modules/pets/application/settings";
import { invalidateUserModelCache } from "~/modules/user/application/userOperations";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";

export async function updateUserSettings(
  context: ServiceContext,
  settings: any,
  userId?: number,
): Promise<{ success: boolean; message: string }> {
  context.ensureDatabase();

  const repo = context.repositories.get(UserSettingsRepository);
  const id = userId ?? context.requireUser().id;

  await repo.createUserSettings(id);

  const validatedSettings = await validatePetSettingsUpdate(context, id, settings);

  await repo.updateUserSettings(id, validatedSettings);

  if (validatedSettings.advertise_machines === false) {
    await context.repositories.get(MachineRepository).deleteAllForUser(id);
  }

  await invalidateUserModelCache(context, id, "update-user-settings");

  return {
    success: true,
    message: "User settings updated successfully",
  };
}
