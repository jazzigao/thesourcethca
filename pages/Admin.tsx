import { useListProducts, useUpdateProduct } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ProductUpdateStatus } from "@workspace/api-client-react";
import { getProductImage } from "@/lib/product-images";

export default function Admin() {
  const { data: products, isLoading, refetch } = useListProducts();
  const updateProduct = useUpdateProduct();
  
  // Local state for edits
  const [edits, setEdits] = useState<Record<string, { stock: number; status: ProductUpdateStatus }>>({});

  // Initialize edits when products load
  useEffect(() => {
    if (products) {
      const initialEdits: Record<string, { stock: number; status: ProductUpdateStatus }> = {};
      products.forEach(p => {
        initialEdits[p.id] = { 
          stock: p.stock, 
          status: p.status as ProductUpdateStatus 
        };
      });
      setEdits(initialEdits);
    }
  }, [products]);

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  const handleStockChange = (id: string, value: string) => {
    const stock = parseInt(value, 10);
    if (isNaN(stock) || stock < 0) return;
    
    setEdits(prev => ({
      ...prev,
      [id]: { ...prev[id], stock }
    }));
  };

  const handleStatusChange = (id: string, status: ProductUpdateStatus) => {
    setEdits(prev => ({
      ...prev,
      [id]: { ...prev[id], status }
    }));
  };

  const handleSave = (id: string) => {
    const edit = edits[id];
    if (!edit) return;

    updateProduct.mutate({
      id,
      data: edit
    }, {
      onSuccess: () => {
        toast.success("Product updated successfully");
        refetch(); // Refresh to ensure sync
      },
      onError: () => {
        toast.error("Failed to update product");
      }
    });
  };

  const hasChanges = (id: string) => {
    const product = products?.find(p => p.id === id);
    const edit = edits[id];
    if (!product || !edit) return false;
    return product.stock !== edit.stock || product.status !== edit.status;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="space-y-4 border-b border-border/50 pb-6 pt-2">
        <h1 className="font-serif text-4xl md:text-6xl tracking-tight">Admin Console</h1>
        <p className="text-xl md:text-2xl text-muted-foreground font-light">Manage product inventory and availability.</p>
      </div>

      <div className="layered-border listing-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-foreground uppercase text-xs font-bold tracking-[0.1em]">
              <tr>
                <th className="px-4 py-4 border-b border-border/50">Product</th>
                <th className="px-4 py-4 border-b border-border/50">Type</th>
                <th className="px-4 py-4 border-b border-border/50">Stock</th>
                <th className="px-4 py-4 border-b border-border/50">Status</th>
                <th className="px-4 py-4 border-b border-border/50 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {products?.map(product => {
                const edit = edits[product.id];
                if (!edit) return null;
                const changed = hasChanges(product.id);

                return (
                  <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 border border-border/50 bg-muted overflow-hidden shrink-0 rounded-md">
                          <img
                            src={getProductImage(product)}
                            alt={product.name}
                            width={1024}
                            height={1024}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <span className="item-title text-2xl">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold uppercase text-xs tracking-widest text-primary">
                      {product.type}
                    </td>
                    <td className="px-4 py-3">
                      <Input 
                        type="number" 
                        min="0"
                        value={edit.stock}
                        onChange={(e) => handleStockChange(product.id, e.target.value)}
                         className="w-24 h-10 bg-background rounded-md border-border/50 focus-visible:border-accent"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select 
                        value={edit.status}
                        onChange={(e) => handleStatusChange(product.id, e.target.value as ProductUpdateStatus)}
                        className="h-10 bg-background border border-border/50 rounded-md px-3 text-sm focus-visible:outline-none focus-visible:border-accent"
                      >
                        <option value="available">Available</option>
                        <option value="sold_out">Sold Out</option>
                        <option value="coming_soon">Coming Soon</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button 
                        size="sm" 
                        variant={changed ? "default" : "outline"}
                        disabled={!changed || updateProduct.isPending}
                        onClick={() => handleSave(product.id)}
                        className={`gap-2 rounded-md h-10 px-5 font-bold uppercase tracking-widest text-xs ${changed ? 'lavender-gradient-button hover:shadow-md transition-all' : 'border-border/50'}`}
                      >
                        <Save className="h-4 w-4" />
                        Save
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
