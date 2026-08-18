-- AlterTable
ALTER TABLE "usuario_menu" ADD COLUMN     "acciones" TEXT[] DEFAULT ARRAY[]::TEXT[];
