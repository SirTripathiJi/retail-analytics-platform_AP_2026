import { useEffect, useMemo, useRef, useState } from 'react'
import { MoreHorizontal, Plus, SlidersHorizontal, Trash2, Copy, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from 'lucide-react'
import { Button } from '../ui/button.jsx'
import { Checkbox } from '../ui/checkbox.jsx'
import { Input } from '../ui/input.jsx'

const initialRows = [
  ['Cover page', 'Cover page', 18, 5, 'Eddie Lake'],
  ['Table of contents', 'Table of contents', 29, 24, 'Eddie Lake'],
  ['Executive summary', 'Narrative', 10, 13, 'Eddie Lake'],
  ['Technical approach', 'Narrative', 27, 23, 'Jamik Tashpulatov'],
  ['Design', 'Narrative', 2, 16, 'Jamik Tashpulatov'],
  ['Capabilities', 'Narrative', 20, 8, 'Jamik Tashpulatov'],
  ['Integration with existing systems', 'Narrative', 19, 21, 'Jamik Tashpulatov'],
  ['Innovation and Advantages', 'Narrative', 25, 26, ''],
  ["Overview of EMF's Innovative Solutions", 'Technical content', 7, 23, ''],
  ['Advanced Algorithms and Machine Learning', 'Narrative', 30, 28, ''],
]
const groups = ['Outline', 'Past Performance', 'Key Personnel', 'Focus Documents']
const reviewers = ['Eddie Lake', 'Jamik Tashpulatov', 'Sophie Tan', 'Alex Morgan', 'Hannah Lee']
const initialDocuments = Array.from({ length: 68 }, (_, index) => {
  const base = initialRows[index % initialRows.length]
  const group = index < 10 ? groups[0] : index < 25 ? groups[1] : index < 42 ? groups[2] : groups[3]
  return { id: `doc-${index + 1}`, header: index < 10 ? base[0] : `${base[0]} — ${Math.floor(index / 10) + 1}`, type: base[1], target: base[2], limit: base[3], reviewer: index < 10 ? base[4] : (base[4] || reviewers[index % reviewers.length]), group }
})
const columnList = [
  ['header', 'Header'], ['type', 'Section Type'], ['target', 'Target'], ['limit', 'Limit'], ['reviewer', 'Reviewer'],
]

function AddSectionDialog({ open, setOpen, onAdd }) {
  const dialogRef = useRef(null)
  const [name, setName] = useState('')
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  const create = event => {
    event.preventDefault()
    if (!name.trim()) return
    onAdd(name.trim())
    setName('')
    setOpen(false)
  }
  return <dialog className="dash-dialog" ref={dialogRef} onCancel={() => setOpen(false)} onClose={() => setOpen(false)}>
    <form onSubmit={create} className="dash-dialog-form"><div><span className="dash-dialog-kicker">DOCUMENTS</span><h2>Add a section</h2><p>Create a new section in this document outline.</p></div><label htmlFor="new-section-name">Section name</label><Input id="new-section-name" autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Risk management" required /><label htmlFor="new-section-type">Section type</label><select id="new-section-type" defaultValue="Narrative"><option>Narrative</option><option>Technical content</option><option>Cover page</option><option>Table of contents</option></select><div className="dash-dialog-actions"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit"><Plus size={14} />Add section</Button></div></form>
  </dialog>
}

export function DocumentsTable({ search = '' }) {
  const [activeTab, setActiveTab] = useState('Outline')
  const [rows, setRows] = useState(initialDocuments)
  const [selectedRows, setSelectedRows] = useState(() => new Set())
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(0)
  const [columns, setColumns] = useState(() => Object.fromEntries(columnList.map(([key]) => [key, true])))
  const [addOpen, setAddOpen] = useState(false)

  const filteredRows = useMemo(() => rows.filter(row => row.group === activeTab && row.header.toLowerCase().includes(search.toLowerCase())), [rows, activeTab, search])
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const visibleRows = filteredRows.slice(page * pageSize, (page + 1) * pageSize)
  const allSelected = visibleRows.length > 0 && visibleRows.every(row => selectedRows.has(row.id))
  const someSelected = visibleRows.some(row => selectedRows.has(row.id))
  const toggleRow = (id, checked) => setSelectedRows(current => { const next = new Set(current); checked ? next.add(id) : next.delete(id); return next })
  const togglePage = checked => setSelectedRows(current => { const next = new Set(current); visibleRows.forEach(row => checked ? next.add(row.id) : next.delete(row.id)); return next })
  const updateReviewer = (id, reviewer) => setRows(current => current.map(row => row.id === id ? { ...row, reviewer } : row))
  const deleteRow = id => { setRows(current => current.filter(row => row.id !== id)); setSelectedRows(current => { const next = new Set(current); next.delete(id); return next }) }
  const duplicateRow = row => setRows(current => { const duplicate = { ...row, id: `doc-${Date.now()}`, header: `${row.header} (copy)` }; return [...current.slice(0, rows.indexOf(row) + 1), duplicate, ...current.slice(rows.indexOf(row) + 1)] })
  const addRow = header => setRows(current => [{ id: `doc-${Date.now()}`, header, type: 'Narrative', target: 10, limit: 10, reviewer: '', group: activeTab }, ...current])
  const toggleColumn = key => setColumns(current => ({ ...current, [key]: !current[key] }))

  useEffect(() => { setPage(0); setSelectedRows(new Set()) }, [activeTab, search, pageSize])
  useEffect(() => { if (page >= pageCount) setPage(Math.max(0, pageCount - 1)) }, [page, pageCount])

  return <section className="dash-documents" aria-labelledby="documents-heading">
    <div className="dash-doc-toolbar">
      <div className="dash-tabs" role="tablist" aria-label="Document section">{groups.map(group => <button key={group} role="tab" type="button" aria-selected={activeTab === group} className={activeTab === group ? 'selected' : ''} onClick={() => setActiveTab(group)}>{group}<span>{rows.filter(row => row.group === group).length}</span></button>)}</div>
      <div className="dash-doc-actions"><details className="dash-column-menu"><summary><SlidersHorizontal size={13} />Customize Columns<ChevronDownIcon /></summary><div>{columnList.map(([key, label]) => <label key={key}><Checkbox checked={columns[key]} onChange={() => toggleColumn(key)} />{label}</label>)}</div></details><Button variant="outline" className="dash-add-button" onClick={() => setAddOpen(true)}><Plus size={13} />Add Section</Button></div>
    </div>
    {search && <div className="dash-search-notice"><Search size={13} />Showing matches for “{search}”</div>}
    <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th className="dash-select-col"><Checkbox aria-label="Select all visible rows" checked={allSelected} ref={node => { if (node) node.indeterminate = !allSelected && someSelected }} onChange={event => togglePage(event.target.checked)} /></th>{columns.header && <th>Header</th>}{columns.type && <th>Section Type</th>}{columns.target && <th className="number-col">Target</th>}{columns.limit && <th className="number-col">Limit</th>}{columns.reviewer && <th>Reviewer</th>}<th className="dash-actions-col"><span className="sr-only">Actions</span></th></tr></thead>
      <tbody>{visibleRows.map(row => <tr key={row.id} className={selectedRows.has(row.id) ? 'is-selected' : ''}><td className="dash-select-col"><Checkbox checked={selectedRows.has(row.id)} aria-label={`Select ${row.header}`} onChange={event => toggleRow(row.id, event.target.checked)} /></td>{columns.header && <td className="dash-row-title"><span className="dash-drag">⠿</span>{row.header}</td>}{columns.type && <td><span className="dash-type-pill">{row.type}</span></td>}{columns.target && <td className="number-col"><span className="dash-number-box">{row.target}</span></td>}{columns.limit && <td className="number-col"><span className="dash-number-box">{row.limit}</span></td>}{columns.reviewer && <td><select aria-label={`Reviewer for ${row.header}`} className="dash-reviewer-select" value={row.reviewer} onChange={event => updateReviewer(row.id, event.target.value)}><option value="">Assign reviewer</option>{reviewers.map(name => <option key={name}>{name}</option>)}</select></td>}<td className="dash-actions-col"><details className="dash-row-menu"><summary aria-label={`Actions for ${row.header}`}><MoreHorizontal size={15} /></summary><div><button type="button" onClick={() => duplicateRow(row)}><Copy size={13} />Duplicate</button><button type="button" className="danger" onClick={() => deleteRow(row.id)}><Trash2 size={13} />Delete</button></div></details></td></tr>)}{visibleRows.length === 0 && <tr><td colSpan={7} className="dash-empty-row">No sections match this view.</td></tr>}</tbody></table></div>
    <div className="dash-table-pagination"><span>{selectedRows.size} of {filteredRows.length} sections selected</span><div className="dash-pagination-controls"><label>Rows per page<select aria-label="Rows per page" value={pageSize} onChange={event => setPageSize(Number(event.target.value))}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label><span className="dash-page-label">Page {Math.min(page + 1, pageCount)} of {pageCount}</span><div className="dash-page-buttons"><button aria-label="First page" onClick={() => setPage(0)} disabled={page === 0}><ChevronsLeft size={14} /></button><button aria-label="Previous page" onClick={() => setPage(current => Math.max(0, current - 1))} disabled={page === 0}><ChevronLeft size={14} /></button><button aria-label="Next page" onClick={() => setPage(current => Math.min(pageCount - 1, current + 1))} disabled={page >= pageCount - 1}><ChevronRight size={14} /></button><button aria-label="Last page" onClick={() => setPage(pageCount - 1)} disabled={page >= pageCount - 1}><ChevronsRight size={14} /></button></div></div></div>
    <div className="dash-demo-note">Document rows, KPIs, and analytics on this screen are sample data for demonstration.</div>
    <AddSectionDialog open={addOpen} setOpen={setAddOpen} onAdd={addRow} />
  </section>
}

function ChevronDownIcon() { return <span className="dash-chevron-down" aria-hidden="true">⌄</span> }
