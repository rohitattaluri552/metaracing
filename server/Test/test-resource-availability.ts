import { storage } from "../storage";

async function main() {
  const resources = await storage.getResources();

  console.log("Resources:");
  console.table(resources);

  const triple = resources.find(
    (resource) => resource.name === "Triple Screen SIM",
  );

  if (!triple) {
    throw new Error("Triple Screen SIM not found");
  }

  const date = "2099-01-01";

  console.log("\nTest 1: Free resource");
  console.log(
    await storage.isResourceAvailable(
      triple.id,
      date,
      "18:00",
      "19:00",
      3,
    ),
  );

  console.log("\nTest 2: Party exceeds capacity");
  console.log(
    await storage.isResourceAvailable(
      triple.id,
      date,
      "18:00",
      "19:00",
      4,
    ),
  );

  console.log("\nTest 3: Maintenance resource");
  await storage.updateResource(triple.id, {
    status: "maintenance",
  });

  console.log(
    await storage.isResourceAvailable(
      triple.id,
      date,
      "18:00",
      "19:00",
      2,
    ),
  );

  // Restore resource
  await storage.updateResource(triple.id, {
    status: "active",
  });

  console.log("\nResource restored to active.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});