-- AlterTable
ALTER TABLE `apitoken` ADD COLUMN `passwordapi` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `usernameapi` VARCHAR(191) NOT NULL DEFAULT '';
