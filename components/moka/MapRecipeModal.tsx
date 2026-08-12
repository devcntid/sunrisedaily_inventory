import React, { useState } from 'react';
import { X, Search, CheckCircle2, Circle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Toast } from '@/components/ui/Toast';

interface Recipe {
    id: number;
    name: string;
    category?: string;
}

interface MokaItem {
    id: string;
    name: string;
    category: string;
    internal_recipe_id?: number | null;
    mapped_recipe_name?: string | null;
}

interface MapRecipeModalProps {
    isOpen: boolean;
    onClose: () => void;
    mokaItem: MokaItem | null;
    recipes: Recipe[];
}

export default function MapRecipeModal({ isOpen, onClose, mokaItem, recipes }: MapRecipeModalProps) {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; isOpen: boolean }>({ message: '', type: 'info', isOpen: false });

    const showToast = (message: string, type: 'success' | 'error' | 'info') => {
        setToast({ message, type, isOpen: true });
    };

    const hideToast = () => {
        setToast(prev => ({ ...prev, isOpen: false }));
    };

    // Initialize selection when modal opens
    React.useEffect(() => {
        if (isOpen && mokaItem) {
            setSelectedRecipeId(mokaItem.internal_recipe_id || null);
            setSearch('');
            setIsSaving(false);
        }
    }, [isOpen, mokaItem]);

    if (!isOpen || !mokaItem) return null;

    const filteredRecipes = recipes.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        (r.category && r.category.toLowerCase().includes(search.toLowerCase()))
    );

    const handleSave = async () => {
        if (!selectedRecipeId) {
            showToast("Please select a recipe first.", "error");
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch('/api/moka/map-item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    moka_variant_id: mokaItem.id,
                    internal_recipe_id: selectedRecipeId
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to save mapping.');
            }

            showToast("Item mapped successfully!", "success");

            setTimeout(() => {
                onClose();
                router.refresh();
            }, 1000);

        } catch (error: any) {
            showToast(error.message, "error");
            setIsSaving(false);
        }
    };

    const handleRemoveMapping = async () => {
        if (!confirm("Are you sure you want to remove this mapping?")) return;

        setIsSaving(true);
        try {
            const res = await fetch('/api/moka/map-item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    moka_variant_id: mokaItem.id,
                    internal_recipe_id: null // Set to null to remove
                })
            });

            if (!res.ok) throw new Error('Failed to remove mapping.');

            showToast("Mapping removed successfully.", "success");
            setTimeout(() => {
                onClose();
                router.refresh();
            }, 1000);
        } catch (error: any) {
            showToast(error.message, "error");
            setIsSaving(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(2px)', padding: '20px'
        }}>
            <div style={{
                background: '#ffffff', width: '100%', maxWidth: '650px', borderRadius: '12px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                display: 'flex', flexDirection: 'column', maxHeight: '85vh', overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex',
                    alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontFamily: 'var(--font-cabin)', fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                            Map to Master Recipe
                        </h3>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                            Select the Sunrise Daily recipe that matches this Moka item.
                        </p>
                    </div>
                    <button 
                        onClick={onClose} 
                        style={{
                            background: 'transparent', border: 'none', padding: '6px', cursor: 'pointer',
                            borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#64748b', transition: 'background 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
                    
                    {/* Selected Item Info Card */}
                    <div style={{
                        background: '#ffffff', border: '1px solid var(--border)', borderRadius: '10px',
                        padding: '10px 14px', marginBottom: '16px', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                    }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                            Moka POS Item
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', marginBottom: '2px' }}>
                            {mokaItem.name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                            {mokaItem.category || 'Uncategorized'}
                        </div>
                    </div>

                    {/* Recipe Selection */}
                    <div>
                        <label style={{
                            display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 700,
                            color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px'
                        }}>
                            Select Master Recipe
                        </label>
                        
                        <div style={{ position: 'relative', marginBottom: '12px' }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="text"
                                placeholder="Search recipe name..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="input"
                                style={{ width: '100%', paddingLeft: '36px', height: '40px' }}
                            />
                        </div>

                        <div style={{
                            background: '#ffffff', border: '1px solid var(--border)', borderRadius: '10px',
                            maxHeight: '400px', overflowY: 'auto', boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)'
                        }}>
                            {filteredRecipes.length === 0 ? (
                                <div style={{ padding: '32px 20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                                    No recipes found matching your search.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {filteredRecipes.map((recipe, index) => {
                                        const isSelected = selectedRecipeId === recipe.id;
                                        return (
                                            <div
                                                key={recipe.id}
                                                onClick={() => setSelectedRecipeId(recipe.id)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    padding: '8px 12px', cursor: 'pointer',
                                                    borderBottom: index < filteredRecipes.length - 1 ? '1px solid #f1f5f9' : 'none',
                                                    background: isSelected ? '#f0fdf4' : 'transparent',
                                                    transition: 'background 0.15s ease'
                                                }}
                                                onMouseOver={(e) => !isSelected && (e.currentTarget.style.background = '#f8fafc')}
                                                onMouseOut={(e) => !isSelected && (e.currentTarget.style.background = 'transparent')}
                                            >
                                                <div style={{ fontSize: '13px', fontWeight: isSelected ? 600 : 500, color: isSelected ? '#016e3f' : '#334155' }}>
                                                    {recipe.name}
                                                </div>
                                                <div style={{ color: isSelected ? '#016e3f' : '#cbd5e1', display: 'flex' }}>
                                                    {isSelected ? (
                                                        <CheckCircle2 size={18} strokeWidth={2.5} />
                                                    ) : (
                                                        <Circle size={18} strokeWidth={1.5} />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div style={{
                    padding: '12px 20px', borderTop: '1px solid var(--border)', background: '#ffffff',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0
                }}>
                    <div>
                        {mokaItem.internal_recipe_id && (
                            <button
                                type="button"
                                onClick={handleRemoveMapping}
                                disabled={isSaving}
                                className="btn"
                                style={{
                                    background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca',
                                    padding: '8px 14px', fontSize: '13px', fontWeight: 600
                                }}
                            >
                                Remove Mapping
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="btn btn-outline"
                            style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 600 }}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving || !selectedRecipeId || selectedRecipeId === mokaItem.internal_recipe_id}
                            className="btn btn-primary"
                            style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 600 }}
                        >
                            {isSaving ? 'Saving...' : 'Save Mapping'}
                        </button>
                    </div>
                </div>
            </div>

            <Toast
                isOpen={toast.isOpen}
                message={toast.message}
                type={toast.type}
                onClose={hideToast}
            />
        </div>
    );
}
