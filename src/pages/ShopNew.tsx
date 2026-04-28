import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUpload } from "@/components/ImageUpload";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type ProductCategory = Database["public"]["Enums"]["product_category"];

const ShopNew = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ProductCategory>("food");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("10");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) return toast.error("Sign in first");
    if (!title || !price) return toast.error("Title and price required");
    setSaving(true);
    const { error } = await supabase.from("shop_products").insert({
      seller_id: user.id,
      title,
      description: description || null,
      category,
      price_inr: parseInt(price),
      stock: parseInt(stock || "0"),
      image_url: imageUrl || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Product listed");
    nav("/shop");
  };

  return (
    <div className="container-app pad-top-safe pb-24">
      <header className="pt-4 pb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-xl">New product</h1>
      </header>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as ProductCategory)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="food">Food</SelectItem>
              <SelectItem value="toys">Toys</SelectItem>
              <SelectItem value="accessories">Accessories</SelectItem>
              <SelectItem value="health">Health</SelectItem>
              <SelectItem value="grooming">Grooming</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Price (₹)</Label>
            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Stock</Label>
            <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Product image</Label>
          <ImageUpload value={imageUrl || null} onChange={(u) => setImageUrl(u || "")} aspect="square" label="Add product photo" />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
        </div>
        <Button onClick={submit} disabled={saving} className="w-full rounded-full h-12">
          {saving ? "Saving…" : "Publish product"}
        </Button>
      </div>
    </div>
  );
};

export default ShopNew;
