export const BREEDS: Record<string, string[]> = {
  dog: [
    "Indie / Mixed", "Labrador Retriever", "Golden Retriever", "German Shepherd",
    "Beagle", "Pug", "Shih Tzu", "Pomeranian", "Rottweiler", "Doberman",
    "Dachshund", "Boxer", "Husky", "Cocker Spaniel", "Dalmatian",
    "French Bulldog", "Bulldog", "Chihuahua", "Border Collie", "Great Dane",
    "Saint Bernard", "Mastiff", "Indie Pariah", "Mudhol Hound", "Rajapalayam",
  ],
  cat: [
    "Indie / Mixed", "Persian", "Siamese", "Maine Coon", "Bengal",
    "British Shorthair", "Ragdoll", "Russian Blue", "Sphynx", "Burmese",
    "Himalayan", "Abyssinian", "Bombay",
  ],
  bird: [
    "Budgerigar", "Cockatiel", "Lovebird", "Indian Ringneck", "African Grey",
    "Macaw", "Cockatoo", "Finch", "Canary", "Conure",
  ],
  rabbit: [
    "Holland Lop", "Mini Rex", "Lionhead", "Netherland Dwarf",
    "Flemish Giant", "Angora", "Dutch", "Indie / Mixed",
  ],
  other: ["Mixed", "Hamster", "Guinea Pig", "Turtle", "Fish", "Hedgehog", "Other"],
};

export const TEMPERAMENT_TAGS = [
  "Calm", "Playful", "Affectionate", "Independent", "Anxious",
  "Reactive", "Curious", "Protective", "Shy", "Energetic", "Gentle", "Vocal",
];

export const COMMON_ALLERGIES = [
  "Chicken", "Beef", "Fish", "Dairy", "Wheat / Gluten",
  "Eggs", "Soy", "Lamb", "Pork", "Pollen", "Dust",
];

export const COMMON_CONDITIONS = [
  "Hip dysplasia", "Diabetes", "Epilepsy", "Heart disease",
  "Skin allergies", "Arthritis", "Kidney disease", "Hypothyroid", "Cataracts",
];

export const GOALS = [
  { id: "social",   label: "Socialise my pet",     blurb: "Friends, walks, posts" },
  { id: "mating",   label: "Find a mate",          blurb: "Verified breeding circles" },
  { id: "vet",      label: "Vet & AI help",         blurb: "Triage and tele-consults" },
  { id: "services", label: "Walking & boarding",   blurb: "Trusted local providers" },
  { id: "shop",     label: "Shop essentials",      blurb: "Food, toys, accessories" },
  { id: "vault",    label: "Health records",        blurb: "Vault and reminders" },
];
