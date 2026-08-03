import { useState, ReactNode } from 'react'

interface Column<T> {
  key: keyof T | string
  label: string
  render?: (item: T, index: number) => ReactNode
  sortable?: boolean
  className?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  isLoading?: boolean
  emptyMessage?: string
  onRowClick?: (item: T) => void
}

/**
 * 📊 Tableau de données générique et réutilisable
 * 
 * Fonctionnalités :
 * - Tri par colonne (si sortable: true)
 * - Rendu personnalisé via render()
 * - Gestion état de chargement / vide
 * - Clic sur ligne optionnel
 * 
 * Usage :
 * <DataTable 
 *   data={classes}
 *   columns={[
 *     { key: 'nom', label: 'Nom', sortable: true },
 *     { key: 'statut', label: 'Statut', render: (c) => <StatusBadge {...c} /> }
 *   ]}
 * />
 */
export default function DataTable<T extends { id: string }>({
  data,
  columns,
  isLoading = false,
  emptyMessage = 'Aucune donnée à afficher',
  onRowClick,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | string | null>(null)
  const [sortAsc, setSortAsc] = useState(true)

  // 🔄 Gestion du tri
  const handleSort = (key: keyof T | string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  // 🎯 Données triées (copie pour ne pas muter l'original)
  const sortedData = [...data].sort((a, b) => {
    if (!sortKey) return 0
    
    const aValue = a[sortKey as keyof T]
    const bValue = b[sortKey as keyof T]
    
    // Gestion des valeurs null/undefined
    if (aValue == null && bValue == null) return 0
    if (aValue == null) return sortAsc ? 1 : -1
    if (bValue == null) return sortAsc ? -1 : 1
    
    // Comparaison selon le type
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortAsc 
        ? aValue.localeCompare(bValue) 
        : bValue.localeCompare(aValue)
    }
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortAsc ? aValue - bValue : bValue - aValue
    }
    return 0
  })

  // ⏳ État de chargement
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
        <span className="ml-3 text-neutral-600">Chargement...</span>
      </div>
    )
  }

  // 📭 État vide
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-neutral-500">
        <p className="text-lg mb-2">📭</p>
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200">
      <table className="min-w-full divide-y divide-neutral-200 bg-white">
        
        {/* 📋 En-têtes */}
        <thead className="bg-neutral-50">
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                onClick={() => col.sortable && handleSort(col.key)}
                className={`px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider ${
                  col.sortable ? 'cursor-pointer hover:text-neutral-900 select-none' : ''
                } ${col.className || ''}`}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <span className="text-primary-600">
                      {sortAsc ? '▲' : '▼'}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        {/* 📄 Corps du tableau */}
        <tbody className="divide-y divide-neutral-100">
          {sortedData.map((item, index) => (
            <tr
              key={item.id}
              onClick={() => onRowClick?.(item)}
              className={`${
                onRowClick ? 'cursor-pointer hover:bg-primary-50 transition-colors' : ''
              }`}
            >
              {columns.map((col) => (
                <td
                  key={`${item.id}-${String(col.key)}`}
                  className={`px-4 py-3 text-sm text-neutral-900 ${col.className || ''}`}
                >
                  {col.render 
                    ? col.render(item, index) 
                    : String(item[col.key as keyof T] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}