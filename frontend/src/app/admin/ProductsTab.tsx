'use client';

import { useEffect, useRef, useState } from 'react';
import { adminApi, type Product, type Category } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8001';

export default function ProductsTab({ token }: { token: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  function load() {
    setLoading(true);
    Promise.all([adminApi.listAllProducts(token), adminApi.listCategories(token)])
      .then(([p, c]) => {
        setProducts(p);
        setCategories(c);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'حصل خطأ'))
      .finally(() => setLoading(false));
  }
  useEffect(load, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDeleteProduct(id: string) {
    if (!confirm('متأكدة إنك عايزة تحذفي المنتج ده؟')) return;
    await adminApi.deleteProduct(token, id);
    load();
  }

  return (
    <div>
      <CategoriesPanel token={token} categories={categories} onChanged={load} />

      {error && <div className="rounded-md p-3 my-4 text-[13.5px]" style={{ background: 'rgba(201,123,138,0.15)', color: 'var(--rose)' }}>{error}</div>}

      <div className="flex justify-between items-center mt-10 mb-5">
        <h2 className="text-xl">المنتجات</h2>
        <button className="btn btn-primary" onClick={() => setShowNewProduct(true)} disabled={categories.length === 0}>
          + منتج جديد
        </button>
      </div>

      <div className="rounded-lg border overflow-hidden" style={{ background: 'var(--cream)', borderColor: 'var(--line)' }}>
        {loading ? (
          <div className="p-6 text-center" style={{ color: '#8a8074' }}>جاري التحميل...</div>
        ) : products.length === 0 ? (
          <div className="p-6 text-center" style={{ color: '#8a8074' }}>مفيش منتجات لسه.</div>
        ) : (
          <table className="w-full text-[13.5px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                <th className="text-right p-3 text-[11.5px] font-bold" style={{ color: '#8a8074' }}>الصورة</th>
                <th className="text-right p-3 text-[11.5px] font-bold" style={{ color: '#8a8074' }}>الاسم</th>
                <th className="text-right p-3 text-[11.5px] font-bold" style={{ color: '#8a8074' }}>الفئة</th>
                <th className="text-right p-3 text-[11.5px] font-bold" style={{ color: '#8a8074' }}>السعر</th>
                <th className="text-right p-3 text-[11.5px] font-bold" style={{ color: '#8a8074' }}>الكمية</th>
                <th className="text-right p-3 text-[11.5px] font-bold" style={{ color: '#8a8074' }}>الحالة</th>
                <th className="text-right p-3 text-[11.5px] font-bold" style={{ color: '#8a8074' }}></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <ProductRow key={p.id} product={p} token={token} onChanged={load} onEdit={() => setEditing(p)} onDelete={() => handleDeleteProduct(p.id)} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNewProduct && (
        <ProductFormModal
          token={token}
          categories={categories}
          onClose={() => setShowNewProduct(false)}
          onSaved={() => { setShowNewProduct(false); load(); }}
        />
      )}
      {editing && (
        <ProductFormModal
          token={token}
          categories={categories}
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function ProductRow({
  product,
  token,
  onChanged,
  onEdit,
  onDelete,
}: {
  product: Product;
  token: string;
  onChanged: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await adminApi.uploadProductImage(token, product.id, file);
      onChanged();
    } catch {
      alert('تعذر رفع الصورة');
    } finally {
      setUploading(false);
    }
  }

  return (
    <tr style={{ borderBottom: '1px solid var(--line)', opacity: product.stock_status === 'out' ? 0.7 : 1 }}>
      <td className="p-3">
        <button
          onClick={() => fileRef.current?.click()}
          className="w-12 h-12 rounded-md flex items-center justify-center overflow-hidden flex-none"
          style={{ background: 'var(--parchment-2)', border: '1px solid var(--line)' }}
          title="اضغطي لتغيير الصورة"
        >
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${API_BASE}${product.image_url}`} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <span style={{ fontSize: 10, color: '#8a8074' }}>{uploading ? '...' : '+ صورة'}</span>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
      </td>
      <td className="p-3 font-bold">{product.name}</td>
      <td className="p-3">{product.category_name}</td>
      <td className="p-3">{product.sale_price.toLocaleString('ar-EG')} ج.م</td>
      <td className="p-3">{product.quantity}</td>
      <td className="p-3">
        <span
          className="badge"
          style={{
            background: product.stock_status === 'out' ? 'rgba(201,123,138,0.18)' : product.stock_status === 'low' ? 'rgba(201,134,42,0.15)' : 'rgba(91,140,90,0.14)',
            color: product.stock_status === 'out' ? 'var(--rose)' : product.stock_status === 'low' ? '#c9862a' : 'var(--ok)',
          }}
        >
          {product.stock_status === 'out' ? 'نفذ' : product.stock_status === 'low' ? 'منخفض' : 'متوفر'}
        </span>
      </td>
      <td className="p-3">
        <div className="flex gap-2">
          <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 12.5 }} onClick={onEdit}>تعديل</button>
          <button className="btn" style={{ padding: '5px 10px', fontSize: 12.5, background: 'rgba(201,123,138,0.15)', color: 'var(--rose)' }} onClick={onDelete}>حذف</button>
        </div>
      </td>
    </tr>
  );
}

function ProductFormModal({
  token,
  categories,
  product,
  onClose,
  onSaved,
}: {
  token: string;
  categories: Category[];
  product?: Product;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!product;
  const [name, setName] = useState(product?.name || '');
  const [categoryId, setCategoryId] = useState(product?.category_id || categories[0]?.id || '');
  const [salePrice, setSalePrice] = useState(product ? String(product.sale_price) : '');
  const [quantity, setQuantity] = useState(product ? String(product.quantity) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isEdit && product) {
        await adminApi.updateProduct(token, product.id, {
          name,
          category_id: categoryId,
          sale_price: Number(salePrice) || 0,
          quantity: Number(quantity) || 0,
        });
      } else {
        await adminApi.createProduct(token, {
          name,
          category_id: categoryId,
          sale_price: Number(salePrice) || 0,
          quantity: Number(quantity) || 0,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حصل خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={modalStyle}>
        <h2 className="text-xl mb-5">{isEdit ? 'تعديل المنتج' : 'منتج جديد'}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <div className="rounded-md p-3 text-[13.5px]" style={{ background: 'rgba(201,123,138,0.15)', color: 'var(--rose)' }}>{error}</div>}
          <div className="field">
            <label>اسم المنتج</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label>الفئة</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="field">
              <label>سعر البيع (ج.م)</label>
              <input type="number" min={0} value={salePrice} onChange={(e) => setSalePrice(e.target.value)} required />
            </div>
            <div className="field">
              <label>الكمية</label>
              <input type="number" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button className="btn btn-primary" disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CategoriesPanel({ token, categories, onChanged }: { token: string; categories: Category[]; onChanged: () => void }) {
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await adminApi.createCategory(token, newName.trim());
      setNewName('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إضافة الفئة');
    }
  }

  async function handleRename(id: string) {
    try {
      await adminApi.updateCategory(token, id, renameValue.trim());
      setRenamingId(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تعديل الفئة');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('متأكدة؟ لازم متكونش فيها منتجات.')) return;
    try {
      const res = await adminApi.deleteCategory(token, id);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'تعذر حذف الفئة');
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حذف الفئة');
    }
  }

  return (
    <div>
      <h2 className="text-xl mb-4">الفئات</h2>
      {error && <div className="rounded-md p-3 mb-3 text-[13.5px]" style={{ background: 'rgba(201,123,138,0.15)', color: 'var(--rose)' }}>{error}</div>}
      <div className="flex flex-wrap gap-2 mb-4">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-full pl-2 pr-3 py-1.5" style={{ background: 'var(--parchment-2)' }}>
            {renamingId === c.id ? (
              <>
                <input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  autoFocus
                  style={{ border: '1px solid var(--line)', borderRadius: 4, padding: '2px 6px', fontSize: 12.5, width: 100 }}
                />
                <button onClick={() => handleRename(c.id)} style={{ color: 'var(--ok)', fontSize: 12 }}>✓</button>
                <button onClick={() => setRenamingId(null)} style={{ color: 'var(--rose)', fontSize: 12 }}>✕</button>
              </>
            ) : (
              <>
                <span className="text-[13px] font-bold" style={{ color: 'var(--forest)' }}>{c.name}</span>
                <button onClick={() => { setRenamingId(c.id); setRenameValue(c.name); }} style={{ color: 'var(--forest)', fontSize: 12 }}>✎</button>
                <button onClick={() => handleDelete(c.id)} style={{ color: 'var(--rose)', fontSize: 12 }}>✕</button>
              </>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="اسم فئة جديدة"
          style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '8px 12px', fontSize: 13.5 }}
        />
        <button className="btn btn-secondary">+ إضافة فئة</button>
      </form>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(21,42,33,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20,
};
const modalStyle: React.CSSProperties = {
  background: 'var(--cream)', borderRadius: 10, padding: 26, width: '100%', maxWidth: 460, maxHeight: '85vh', overflowY: 'auto',
};
