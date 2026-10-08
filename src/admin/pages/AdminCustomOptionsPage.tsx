import { useCallback, useEffect, useMemo, useState } from 'react'
import { Breadcrumb } from '@/admin/components/Breadcrumb'
import { AdminConfirmModal } from '@/admin/components/AdminConfirmModal'
import { AdminTable } from '@/admin/components/AdminTable'
import { AdminBadge, AdminEmptyState, AdminErrorState, AdminLoadingState } from '@/admin/components/AdminStates'
import {
  createCustomOption,
  deleteCustomOption,
  getCustomOptionsForAdmin,
  readCustomOptionApiError,
  readCustomOptionFieldErrors,
} from '@/api/customOptions'
import { OPTION_TYPES } from '@/types/api/CustomPieceDto'
import type {
  ColourDto,
  CustomOptionsDto,
  GarmentDto,
  OptionType,
  PrintTypeDto,
  SizeDto,
} from '@/types/api/CustomPieceDto'
import { updateCustomOption } from '@/api/customOptions'

/**
 * Admin — Custom Piece options.
 *
 * One screen over `/v1/custom_options/`, tabbed by the four `option_type` values the
 * published schema defines. Everything sent here comes from that schema: `option_type`,
 * `name`, `description`, `hex_code`, `image`, `colour_ids`, `display_order`, `is_active`.
 *
 * The read uses `include_inactive=true` with the admin token, so inactive options stay
 * findable and can be switched back on. The storefront's own read is a separate, public,
 * unauthenticated call — the two never share a request.
 */

type TabKey = OptionType

const TABS: { key: TabKey; label: string }[] = [
  { key: 'GARMENT', label: 'Garments' },
  { key: 'COLOUR', label: 'Colours' },
  { key: 'SIZE', label: 'Sizes' },
  { key: 'PRINT_TYPE', label: 'Print Types' },
]

/** Which extra fields each type actually carries, per the schema's own notes. */
const HAS_IMAGE: Record<TabKey, boolean> = { GARMENT: true, COLOUR: false, SIZE: false, PRINT_TYPE: true }
const HAS_DESCRIPTION: Record<TabKey, boolean> = { GARMENT: true, COLOUR: false, SIZE: false, PRINT_TYPE: true }

type AnyOption = GarmentDto | ColourDto | SizeDto | PrintTypeDto

type FormState = {
  /** null while adding; the option's id while editing. */
  id: number | null
  type: TabKey
  name: string
  description: string
  hexCode: string
  image: File | null
  colourIds: number[]
  displayOrder: string
  isActive: boolean
}

const emptyForm = (type: TabKey): FormState => ({
  id: null,
  type,
  name: '',
  description: '',
  hexCode: type === 'COLOUR' ? '#000000' : '',
  image: null,
  colourIds: [],
  displayOrder: '',
  isActive: true,
})

const isActive = (o: AnyOption) => o.is_active !== false

export function AdminCustomOptionsPage() {
  const [tab, setTab] = useState<TabKey>('GARMENT')
  const [data, setData] = useState<CustomOptionsDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<FormState | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [pendingDelete, setPendingDelete] = useState<AnyOption | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await getCustomOptionsForAdmin())
    } catch (err) {
      setError(readCustomOptionApiError(err, 'Unable to load Custom Piece options.'))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const colours = useMemo(() => data?.colours ?? [], [data])
  const garments = useMemo(() => data?.garments ?? [], [data])

  const rows: AnyOption[] = useMemo(() => {
    if (!data) return []
    if (tab === 'GARMENT') return data.garments
    if (tab === 'COLOUR') return data.colours
    if (tab === 'SIZE') return data.sizes
    return data.print_types
  }, [data, tab])

  /** Colour name by id, so a garment's `colour_ids` reads as names rather than numbers. */
  const colourName = useCallback(
    (id: number) => colours.find((c) => c.id === id)?.name ?? `#${id}`,
    [colours],
  )

  /**
   * Garments that would be left with NO active colour if this colour were switched off.
   *
   * The public endpoint hides any garment with no active colour, so this is the difference
   * between "a swatch disappears" and "the whole garment vanishes from the storefront".
   * Worth saying out loud before the toggle, not after.
   */
  const garmentsStrandedBy = useCallback(
    (colourId: number): string[] =>
      garments
        .filter((g) => isActive(g) && g.colour_ids.includes(colourId))
        .filter((g) => g.colour_ids.filter((id) => id !== colourId).every((id) => {
          const c = colours.find((x) => x.id === id)
          return !c || !isActive(c)
        }))
        .map((g) => g.name),
    [garments, colours],
  )

  const openAdd = () => {
    setForm(emptyForm(tab))
    setFieldErrors({})
    setFormError(null)
  }

  const openEdit = (option: AnyOption) => {
    const garment = tab === 'GARMENT' ? (option as GarmentDto) : null
    const colour = tab === 'COLOUR' ? (option as ColourDto) : null
    const described = option as Partial<GarmentDto & PrintTypeDto>
    setForm({
      id: option.id,
      type: tab,
      name: option.name,
      description: described.description ?? '',
      hexCode: colour?.hex_code ?? '',
      image: null,
      colourIds: garment ? [...garment.colour_ids] : [],
      displayOrder: String(option.display_order ?? ''),
      isActive: isActive(option),
    })
    setFieldErrors({})
    setFormError(null)
  }

  const closeForm = () => {
    setForm(null)
    setFieldErrors({})
    setFormError(null)
  }

  const field = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))

  const validate = (f: FormState): Record<string, string> => {
    const errors: Record<string, string> = {}
    if (!f.name.trim()) errors.name = 'Name is required.'
    if (f.type === 'COLOUR' && !/^#[0-9a-fA-F]{6}$/.test(f.hexCode.trim())) {
      errors.hex_code = 'Enter a hex code like #000000.'
    }
    if (f.type === 'GARMENT' && f.colourIds.length === 0) {
      errors.colour_ids = 'Choose at least one colour this garment comes in.'
    }
    if (f.displayOrder.trim() && !/^[1-9]\d*$/.test(f.displayOrder.trim())) {
      errors.display_order = 'Display order must be a whole number from 1.'
    }
    return errors
  }

  const handleSave = async () => {
    if (!form || saving) return

    const invalid = validate(form)
    if (Object.keys(invalid).length > 0) {
      setFieldErrors(invalid)
      setFormError(null)
      return
    }

    setSaving(true)
    setFieldErrors({})
    setFormError(null)

    // Only the fields this option type actually uses are sent, so a SIZE never carries an
    // empty hex_code and a COLOUR never carries an image.
    const order = form.displayOrder.trim() ? Number(form.displayOrder.trim()) : undefined

    try {
      if (form.id === null) {
        await createCustomOption({
          option_type: form.type,
          name: form.name.trim(),
          ...(HAS_DESCRIPTION[form.type] && form.description.trim() ? { description: form.description.trim() } : {}),
          ...(form.type === 'COLOUR' ? { hex_code: form.hexCode.trim() } : {}),
          ...(HAS_IMAGE[form.type] && form.image ? { image: form.image } : {}),
          ...(form.type === 'GARMENT' ? { colour_ids: form.colourIds } : {}),
          ...(order ? { display_order: order } : {}),
          is_active: form.isActive,
        })
        setNotice('Option created.')
      } else {
        await updateCustomOption({
          id: form.id,
          name: form.name.trim(),
          ...(HAS_DESCRIPTION[form.type] ? { description: form.description.trim() } : {}),
          ...(form.type === 'COLOUR' ? { hex_code: form.hexCode.trim() } : {}),
          ...(HAS_IMAGE[form.type] && form.image ? { image: form.image } : {}),
          ...(form.type === 'GARMENT' ? { colour_ids: form.colourIds } : {}),
          ...(order ? { display_order: order } : {}),
          is_active: form.isActive,
        })
        setNotice('Option updated.')
      }
      closeForm()
      await load()
    } catch (err) {
      // Field errors go beside their inputs; anything else is one line above the actions.
      // The form is never closed and nothing typed is cleared.
      const fields = readCustomOptionFieldErrors(err)
      if (Object.keys(fields).length > 0) setFieldErrors(fields)
      else setFormError(readCustomOptionApiError(err, 'Could not save this option.'))
    } finally {
      setSaving(false)
    }
  }

  /** Active/inactive is just a PUT of `is_active` — the same endpoint as any other edit. */
  const toggleActive = async (option: AnyOption) => {
    setActionError(null)
    setNotice(null)

    if (tab === 'COLOUR' && isActive(option)) {
      const stranded = garmentsStrandedBy(option.id)
      if (stranded.length > 0) {
        const ok = window.confirm(
          `${stranded.join(', ')} ${stranded.length === 1 ? 'has' : 'have'} no other active colour. ` +
            `Turning ${option.name} off will hide ${stranded.length === 1 ? 'it' : 'them'} from customers completely.\n\nContinue?`,
        )
        if (!ok) return
      }
    }

    try {
      await updateCustomOption({ id: option.id, is_active: !isActive(option) })
      await load()
      setNotice(`${option.name} is now ${isActive(option) ? 'inactive' : 'active'}.`)
    } catch (err) {
      setActionError(readCustomOptionApiError(err, 'Could not change this option.'))
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    const target = pendingDelete
    setPendingDelete(null)
    setActionError(null)
    try {
      await deleteCustomOption(target.id)
      await load()
      setNotice(`${target.name} deleted.`)
    } catch (err) {
      setActionError(readCustomOptionApiError(err, 'Could not delete this option.'))
    }
  }

  const headers = useMemo(() => {
    if (tab === 'GARMENT') return ['Image', 'Name', 'Colours', 'Order', 'Status', 'Actions']
    if (tab === 'COLOUR') return ['Swatch', 'Name', 'Hex', 'Order', 'Status', 'Actions']
    if (tab === 'SIZE') return ['Name', 'Order', 'Status', 'Actions']
    return ['Image', 'Name', 'Description', 'Order', 'Status', 'Actions']
  }, [tab])

  const renderRow = (option: AnyOption) => {
    const garment = tab === 'GARMENT' ? (option as GarmentDto) : null
    const colour = tab === 'COLOUR' ? (option as ColourDto) : null
    const printType = tab === 'PRINT_TYPE' ? (option as PrintTypeDto) : null

    return (
      <>
        {tab === 'GARMENT' || tab === 'PRINT_TYPE' ? (
          <td>
            {(garment?.image_url ?? printType?.image_url) ? (
              <img
                src={(garment?.image_url ?? printType?.image_url) as string}
                alt=""
                style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6 }}
              />
            ) : (
              <span className="admin-table__muted">—</span>
            )}
          </td>
        ) : null}

        {tab === 'COLOUR' ? (
          <td>
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                width: 22,
                height: 22,
                borderRadius: '50%',
                border: '1px solid #d4d4d8',
                background: colour?.hex_code ?? 'transparent',
              }}
            />
          </td>
        ) : null}

        <td className="admin-table__primary">{option.name}</td>

        {tab === 'GARMENT' ? (
          <td className="admin-table__muted">
            {garment && garment.colour_ids.length > 0
              ? garment.colour_ids.map(colourName).join(', ')
              : '—'}
          </td>
        ) : null}

        {tab === 'COLOUR' ? <td className="admin-table__muted">{colour?.hex_code ?? '—'}</td> : null}

        {tab === 'PRINT_TYPE' ? (
          <td className="admin-helpdesk__preview">{printType?.description ?? '—'}</td>
        ) : null}

        <td className="admin-table__muted">{option.display_order ?? '—'}</td>

        <td>
          <AdminBadge label={isActive(option) ? 'Active' : 'Inactive'} tone={isActive(option) ? 'solid' : 'outline'} />
        </td>

        <td className="admin-table__actions">
          <button type="button" className="admin-link-button" onClick={() => openEdit(option)}>
            Edit
          </button>
          <button type="button" className="admin-link-button" onClick={() => void toggleActive(option)}>
            {isActive(option) ? 'Deactivate' : 'Activate'}
          </button>
          <button
            type="button"
            className="admin-link-button admin-link-button--danger"
            onClick={() => setPendingDelete(option)}
          >
            Delete
          </button>
        </td>
      </>
    )
  }

  const tabLabel = TABS.find((t) => t.key === tab)?.label ?? ''

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Custom Piece</p>
          <h2>Custom Options</h2>
        </div>
        <Breadcrumb items={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Custom Options' }]} />
      </div>

      <section className="admin-toolbar">
        <div role="tablist" aria-label="Option type" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={tab === t.key ? 'admin-btn' : 'admin-btn admin-btn--ghost'}
              onClick={() => {
                setTab(t.key)
                setNotice(null)
                setActionError(null)
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" className="admin-btn" onClick={openAdd}>
          Add {tabLabel.replace(/s$/, '')}
        </button>
      </section>

      <p className="admin-muted">
        Shown on the Custom Piece page in display order. Customers only ever see active options, and a
        garment with no active colour is hidden from them entirely.
      </p>

      {notice ? <p className="admin-muted">{notice}</p> : null}
      {actionError ? (
        <p className="admin-form__error" role="alert">
          {actionError}
        </p>
      ) : null}

      {loading ? (
        <AdminLoadingState />
      ) : error ? (
        <AdminErrorState title="Unable to load Custom Piece options" message={error} onRetry={() => void load()} />
      ) : rows.length === 0 ? (
        <AdminEmptyState
          title={`No ${tabLabel.toLowerCase()}`}
          message={`Add ${tabLabel.toLowerCase()} to offer them on the Custom Piece page.`}
        />
      ) : (
        <AdminTable headers={headers} rows={rows} getRowKey={(r) => String(r.id)} renderRow={renderRow} />
      )}

      {form ? (
        <div className="admin-modal__backdrop" onClick={closeForm}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${form.id === null ? 'Add' : 'Edit'} ${tabLabel.replace(/s$/, '')}`}
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>
              {form.id === null ? 'Add' : 'Edit'} {tabLabel.replace(/s$/, '')}
            </h3>

            <div className="admin-form">
              <div className="admin-form__field">
                <label htmlFor="co-name">Name</label>
                <input
                  id="co-name"
                  type="text"
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => field('name', e.target.value)}
                />
                {fieldErrors.name ? <span className="admin-form__error">{fieldErrors.name}</span> : null}
              </div>

              {form.type === 'COLOUR' ? (
                <div className="admin-form__field">
                  <label htmlFor="co-hex">Hex code</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      id="co-hex"
                      type="text"
                      maxLength={7}
                      placeholder="#000000"
                      value={form.hexCode}
                      onChange={(e) => field('hexCode', e.target.value)}
                    />
                    <input
                      type="color"
                      aria-label="Pick colour"
                      value={/^#[0-9a-fA-F]{6}$/.test(form.hexCode) ? form.hexCode : '#000000'}
                      onChange={(e) => field('hexCode', e.target.value)}
                      style={{ width: 44, height: 36, padding: 0, border: '1px solid #d4d4d8', borderRadius: 6 }}
                    />
                  </div>
                  {fieldErrors.hex_code ? <span className="admin-form__error">{fieldErrors.hex_code}</span> : null}
                </div>
              ) : null}

              {HAS_DESCRIPTION[form.type] ? (
                <div className="admin-form__field">
                  <label htmlFor="co-description">Description</label>
                  <textarea
                    id="co-description"
                    rows={3}
                    maxLength={500}
                    value={form.description}
                    onChange={(e) => field('description', e.target.value)}
                  />
                  {fieldErrors.description ? (
                    <span className="admin-form__error">{fieldErrors.description}</span>
                  ) : null}
                </div>
              ) : null}

              {HAS_IMAGE[form.type] ? (
                <div className="admin-form__field">
                  <label htmlFor="co-image">Image</label>
                  <input
                    id="co-image"
                    type="file"
                    accept="image/*"
                    onChange={(e) => field('image', e.target.files?.[0] ?? null)}
                  />
                  <span className="admin-muted" style={{ fontSize: '0.75rem' }}>
                    {form.id === null ? 'Optional.' : 'Leave empty to keep the current image.'}
                  </span>
                  {fieldErrors.image ? <span className="admin-form__error">{fieldErrors.image}</span> : null}
                </div>
              ) : null}

              {form.type === 'GARMENT' ? (
                <div className="admin-form__field">
                  <label htmlFor="co-colours">Available in</label>
                  <div id="co-colours" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {colours.length === 0 ? (
                      <span className="admin-muted">Add a colour first.</span>
                    ) : (
                      colours.map((c) => (
                        <label key={c.id} className="admin-form__check" style={{ gap: 6 }}>
                          <input
                            type="checkbox"
                            checked={form.colourIds.includes(c.id)}
                            onChange={(e) =>
                              field(
                                'colourIds',
                                e.target.checked
                                  ? [...form.colourIds, c.id]
                                  : form.colourIds.filter((id) => id !== c.id),
                              )
                            }
                          />
                          <span>
                            {c.name}
                            {isActive(c) ? '' : ' (inactive)'}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                  <span className="admin-muted" style={{ fontSize: '0.75rem' }}>
                    Replaces the garment&rsquo;s whole colour list.
                  </span>
                  {fieldErrors.colour_ids ? (
                    <span className="admin-form__error">{fieldErrors.colour_ids}</span>
                  ) : null}
                </div>
              ) : null}

              <div className="admin-form__field">
                <label htmlFor="co-order">Display order</label>
                <input
                  id="co-order"
                  type="number"
                  min={1}
                  value={form.displayOrder}
                  onChange={(e) => field('displayOrder', e.target.value)}
                />
                <span className="admin-muted" style={{ fontSize: '0.75rem' }}>
                  Leave empty to place it last.
                </span>
                {fieldErrors.display_order ? (
                  <span className="admin-form__error">{fieldErrors.display_order}</span>
                ) : null}
              </div>

              <label className="admin-form__check">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => field('isActive', e.target.checked)}
                />
                <span>Active</span>
              </label>

              {formError ? (
                <p className="admin-form__error" role="alert">
                  {formError}
                </p>
              ) : null}
            </div>

            <div className="admin-modal__actions">
              <button type="button" className="admin-btn admin-btn--ghost" onClick={closeForm} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="admin-btn" onClick={() => void handleSave()} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AdminConfirmModal
        isOpen={pendingDelete !== null}
        title="Delete this option?"
        message={
          pendingDelete
            ? `${pendingDelete.name} will no longer be offered on the Custom Piece page. Existing requests keep its name.`
            : ''
        }
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

/** Re-exported so a future screen can reuse the same tab order without redeclaring it. */
export { OPTION_TYPES }
