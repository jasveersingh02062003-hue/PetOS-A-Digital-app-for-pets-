import { motion } from "framer-motion";

const SPECIES = [
  { value: "dog",    label: "Dog",    img: "/onboarding/dog.jpg" },
  { value: "cat",    label: "Cat",    img: "/onboarding/cat.jpg" },
  { value: "bird",   label: "Bird",   img: "/onboarding/bird.jpg" },
  { value: "rabbit", label: "Rabbit", img: "/onboarding/rabbit.jpg" },
  { value: "other",  label: "Other",  img: "/onboarding/other.jpg" },
] as const;

export type Species = typeof SPECIES[number]["value"];

export const SpeciesPicker = ({
  value, onChange,
}: { value: Species; onChange: (v: Species) => void }) => (
  <div className="grid grid-cols-2 gap-3">
    {SPECIES.map((s, i) => {
      const active = value === s.value;
      return (
        <motion.button
          key={s.value}
          type="button"
          onClick={() => onChange(s.value)}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.04, duration: 0.3 }}
          whileTap={{ scale: 0.96 }}
          className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all ${
            active ? "border-primary shadow-lg" : "border-transparent"
          } ${s.value === "other" && SPECIES.length % 2 === 1 ? "col-span-2 aspect-[2/1]" : ""}`}
        >
          <img
            src={s.img}
            alt={s.label}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            width={1024}
            height={1024}
          />
          <div className={`absolute inset-0 transition-opacity ${
            active ? "bg-primary/15" : "bg-black/0 hover:bg-black/5"
          }`} />
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
            <div className="text-white font-display text-lg">{s.label}</div>
          </div>
        </motion.button>
      );
    })}
  </div>
);
