/*
  Warnings:

  - A unique constraint covering the columns `[productId,shop]` on the table `allProducts` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `AllProducts_productId_key` ON `allproducts`;

-- AlterTable
ALTER TABLE `allproducts` ALTER COLUMN `status` DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX `allProducts_productId_shop_key` ON `allProducts`(`productId`, `shop`);
