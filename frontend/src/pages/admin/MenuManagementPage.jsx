import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api, { apiOrigin } from '../../services/api'
import './admin.css'

const emptyCategory = { name: '', description: '', image: null, availableSizes: [] }
const emptyItem = {
  name: '', description: '', category: '', regularPrice: '', offerPrice: '',
  minimumPreparationMinutes: 15, image: null, availableSizes: [], dietary: [], mealTimes: [],
  sizePricing: [], spicyLevels: [],
  isAvailable: true, isFeatured: false, isBestSeller: false,
}
const sizes = [
  ['small', 'Small'],
  ['medium', 'Medium'],
  ['large', 'Large'],
  ['9_inch', '9 inch'],
  ['10_inch', '10 inch'],
  ['11_inch', '11 inch'],
  ['12_inch', '12 inch'],
  ['family', 'Family size'],
]
const dietaryOptions = [['vegetarian', 'Vegetarian'], ['vegan', 'Vegan'], ['spicy', 'Spicy'], ['gluten_free', 'Gluten-Free'], ['meat_lovers', 'Meat Lovers']]
const mealTimes = [['breakfast', 'Breakfast'], ['snacks', 'Snacks'], ['dinner', 'Dinner'], ['late_night', 'Late Night']]
const spicyLevels = [['25_percent', '25%'], ['50_percent', '50%'], ['75_percent', '75%'], ['super_duper_naga', 'Super Duper Naga']]
const sizeLabels = Object.fromEntries(sizes)

function getErrorMessage(error, fallback) {
  const response = error.response?.data
  if (response?.errors && typeof response.errors === 'object') {
    return Object.entries(response.errors)
      .map(([field, message]) => `${field}: ${message}`)
      .join(' ')
  }
  return response?.message || fallback
}

function shortenDescription(description, wordLimit = 15) {
  const words = (description || '').trim().split(/\s+/).filter(Boolean)
  if (words.length <= wordLimit) return words.join(' ')
  return `${words.slice(0, wordLimit).join(' ')}...`
}

function MenuManagementPage() {
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [categoryForm, setCategoryForm] = useState(emptyCategory)
  const [itemForm, setItemForm] = useState(emptyItem)
  const [editingCategory, setEditingCategory] = useState(null)
  const [editingItem, setEditingItem] = useState(null)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [showItemForm, setShowItemForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [itemPage, setItemPage] = useState(1)
  const itemsPerPage = 9

  const filteredItems = selectedCategory
    ? items.filter((item) => (item.category?._id || item.category) === selectedCategory)
    : items
  const totalItemPages = Math.max(Math.ceil(filteredItems.length / itemsPerPage), 1)
  const visibleItems = filteredItems.slice((itemPage - 1) * itemsPerPage, itemPage * itemsPerPage)

  async function loadMenu() {
    const [categoryResponse, itemResponse] = await Promise.all([
      api.get('/menu/manage/categories'),
      api.get('/menu/manage/items'),
    ])
    setCategories(categoryResponse.data.data || [])
    setItems(itemResponse.data.data || [])
    setItemPage(1)
  }

  useEffect(() => {
    let active = true
    Promise.all([
      api.get('/menu/manage/categories'),
      api.get('/menu/manage/items'),
    ])
      .then(([categoryResponse, itemResponse]) => {
        if (!active) return
        setCategories(categoryResponse.data.data || [])
        setItems(itemResponse.data.data || [])
      })
      .catch((error) => {
        if (active) toast.error(error.response?.data?.message || 'Unable to load menu')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  async function saveCategory(event) {
    event.preventDefault()
    try {
      const payload = new FormData()
      payload.append('name', categoryForm.name)
      payload.append('description', categoryForm.description)
      payload.append('availableSizes', JSON.stringify(categoryForm.availableSizes))
      if (categoryForm.image) payload.append('image', categoryForm.image)
      if (editingCategory) await api.patch(`/menu/manage/categories/${editingCategory}`, payload)
      else await api.post('/menu/manage/categories', payload)
      toast.success(editingCategory ? 'Category updated' : 'Category added')
      setCategoryForm(emptyCategory)
      setEditingCategory(null)
      setShowCategoryForm(false)
      await loadMenu()
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to save category'))
    }
  }

  async function saveItem(event) {
    event.preventDefault()
    try {
      const payload = new FormData()
      Object.entries(itemForm).forEach(([key, value]) => {
        if (key !== 'image' && value !== null && value !== undefined && value !== '') {
          payload.append(key, Array.isArray(value) ? JSON.stringify(value) : value)
        }
      })
      if (itemForm.image) payload.append('image', itemForm.image)
      if (editingItem) await api.patch(`/menu/manage/items/${editingItem}`, payload)
      else await api.post('/menu/manage/items', payload)
      toast.success(editingItem ? 'Food item updated' : 'Food item added')
      setItemForm({ ...emptyItem, category: categories[0]?._id || '' })
      setEditingItem(null)
      setShowItemForm(false)
      await loadMenu()
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to save food item'))
    }
  }

  function setSizeAdjustment(size, adjustment) {
    const current = itemForm.sizePricing.filter((entry) => entry.size !== size)
    setItemForm({ ...itemForm, sizePricing: adjustment === '' ? current : [...current, { size, adjustment }] })
  }

  async function remove(path, message) {
    if (!window.confirm(message)) return
    try {
      await api.delete(path)
      toast.success('Deleted successfully')
      await loadMenu()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to delete')
    }
  }

  return (
    <div>
      <div className="admin-page-heading"><div><p className="admin-eyebrow">MENU MANAGEMENT</p><h1>Menu</h1></div></div>
      <div className="menu-management-grid">
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><p className="admin-eyebrow">FOOD CATEGORIES</p><h2>Categories</h2></div><button className="admin-primary-button compact" type="button" onClick={() => { setEditingCategory(null); setCategoryForm(emptyCategory); setShowCategoryForm(!showCategoryForm) }}>+ Add</button></div>
          {showCategoryForm && <form className="admin-inline-form menu-category-form" onSubmit={saveCategory}><input required placeholder="Category name" value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} /><input placeholder="Description" value={categoryForm.description} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} /><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setCategoryForm({ ...categoryForm, image: event.target.files?.[0] || null })} /><fieldset className="menu-options"><legend>Available sizes</legend>{sizes.map(([value, label]) => <label key={value}><input type="checkbox" checked={categoryForm.availableSizes?.includes(value)} onChange={(event) => setCategoryForm({ ...categoryForm, availableSizes: event.target.checked ? [...categoryForm.availableSizes, value] : categoryForm.availableSizes.filter((size) => size !== value) })} />{label}</label>)}</fieldset><button className="admin-primary-button compact" type="submit">{editingCategory ? 'Save' : 'Create'}</button></form>}
          <div className="menu-list">{!loading && categories.map((category) => <div className="menu-list-row" key={category._id}><div><strong>{category.name}</strong><small>{category.description || 'No description'}</small><small>{category.availableSizes?.map((size) => sizeLabels[size] || size).join(', ') || 'No sizes selected'}</small></div><div className="staff-actions"><button type="button" onClick={() => { setEditingCategory(category._id); setCategoryForm({ name: category.name, description: category.description || '', image: null, availableSizes: category.availableSizes || [] }); setShowCategoryForm(true) }}>Edit</button><button type="button" className="danger" onClick={() => remove(`/menu/manage/categories/${category._id}`, 'Delete this category?')}>Delete</button></div></div>)}{!loading && !categories.length && <p className="admin-empty">No categories yet.</p>}</div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading"><div><p className="admin-eyebrow">FOOD ITEMS</p><h2>Food items</h2></div><button className="admin-primary-button compact" type="button" onClick={() => { setEditingItem(null); setItemForm({ ...emptyItem, category: categories[0]?._id || '' }); setShowItemForm(!showItemForm) }}>+ Add</button></div>
          {showItemForm && <form className="admin-menu-form" onSubmit={saveItem}><div className="admin-form-grid"><label>Name<input required value={itemForm.name} onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })} /></label><label>Category<select required value={itemForm.category} onChange={(event) => setItemForm({ ...itemForm, category: event.target.value })}><option value="">Select category</option>{categories.map((category) => <option value={category._id} key={category._id}>{category.name}</option>)}</select></label><label>Base regular price<input required type="number" min="0" value={itemForm.regularPrice} onChange={(event) => setItemForm({ ...itemForm, regularPrice: event.target.value })} /></label><label>Base offer price<input type="number" min="0" value={itemForm.offerPrice} onChange={(event) => setItemForm({ ...itemForm, offerPrice: event.target.value })} /></label><label>Prep time (minutes)<input required type="number" min="0" value={itemForm.minimumPreparationMinutes} onChange={(event) => setItemForm({ ...itemForm, minimumPreparationMinutes: event.target.value })} /></label><label>Food image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setItemForm({ ...itemForm, image: event.target.files?.[0] || null })} /></label><label className="wide-field">Description<textarea rows="2" value={itemForm.description} onChange={(event) => setItemForm({ ...itemForm, description: event.target.value })} /></label></div><div className="menu-selection-grid"><fieldset className="menu-options"><legend>Available sizes</legend>{sizes.map(([value, label]) => <label key={value}><input type="checkbox" checked={itemForm.availableSizes.includes(value)} onChange={(event) => setItemForm({ ...itemForm, availableSizes: event.target.checked ? [...itemForm.availableSizes, value] : itemForm.availableSizes.filter((size) => size !== value) })} />{label}</label>)}{itemForm.availableSizes.length > 0 && <div className="size-adjustments">{itemForm.availableSizes.map((size) => <label key={size}>{sizeLabels[size]} adjustment<input type="number" min="0" value={itemForm.sizePricing.find((entry) => entry.size === size)?.adjustment ?? ''} onChange={(event) => setSizeAdjustment(size, event.target.value)} /></label>)}</div>}</fieldset><fieldset className="menu-options"><legend>Dietary</legend>{dietaryOptions.map(([value, label]) => <label key={value}><input type="checkbox" checked={itemForm.dietary.includes(value)} onChange={(event) => setItemForm({ ...itemForm, dietary: event.target.checked ? [...itemForm.dietary, value] : itemForm.dietary.filter((entry) => entry !== value), spicyLevels: value === 'spicy' && !event.target.checked ? [] : itemForm.spicyLevels })} />{label}</label>)}{itemForm.dietary.includes('spicy') && <div className="spicy-level-options"><strong>Spicy add-ons</strong>{spicyLevels.map(([value, label]) => <label key={value}><input type="checkbox" checked={itemForm.spicyLevels.includes(value)} onChange={(event) => setItemForm({ ...itemForm, spicyLevels: event.target.checked ? [...itemForm.spicyLevels, value] : itemForm.spicyLevels.filter((level) => level !== value) })} />{label}</label>)}</div>}</fieldset><fieldset className="menu-options"><legend>Meal time</legend>{mealTimes.map(([value, label]) => <label key={value}><input type="checkbox" checked={itemForm.mealTimes.includes(value)} onChange={(event) => setItemForm({ ...itemForm, mealTimes: event.target.checked ? [...itemForm.mealTimes, value] : itemForm.mealTimes.filter((entry) => entry !== value) })} />{label}</label>)}</fieldset></div><div className="menu-checkboxes"><label><input type="checkbox" checked={itemForm.isAvailable} onChange={(event) => setItemForm({ ...itemForm, isAvailable: event.target.checked })} /> Available</label><label><input type="checkbox" checked={itemForm.isFeatured} onChange={(event) => setItemForm({ ...itemForm, isFeatured: event.target.checked })} /> Featured</label><label><input type="checkbox" checked={itemForm.isBestSeller} onChange={(event) => setItemForm({ ...itemForm, isBestSeller: event.target.checked })} /> Best seller</label><button className="admin-primary-button compact" type="submit">{editingItem ? 'Save changes' : 'Create item'}</button></div></form>}
          <div className="menu-item-toolbar">
            <label>Filter by category
              <select value={selectedCategory} onChange={(event) => { setSelectedCategory(event.target.value); setItemPage(1) }}>
                <option value="">All categories</option>
                {categories.map((category) => <option value={category._id} key={category._id}>{category.name}</option>)}
              </select>
            </label>
            <span>{filteredItems.length} item{filteredItems.length === 1 ? '' : 's'}</span>
          </div>
          <div className="menu-card-grid">
            {!loading && visibleItems.map((item) => (
              <article className="menu-item-card" key={item._id}>
                {item.image ? <img src={`${apiOrigin}${item.image}`} alt={item.name} /> : <div className="menu-item-placeholder">No image</div>}
                <div className="menu-item-card-body">
                  <small className="menu-item-category">{item.category?.name || 'Uncategorized'}</small>
                  <h3>{item.name}</h3>
                  <strong>৳{item.offerPrice || item.regularPrice}</strong>
                  <p>{shortenDescription(item.description) || 'No description'}</p>
                  <small>{item.availableSizes?.map((size) => sizeLabels[size] || size).join(', ') || 'No sizes'}</small>
                  <div className="staff-actions">
                    <button type="button" onClick={() => { setEditingItem(item._id); setItemForm({ name: item.name || '', description: item.description || '', category: item.category?._id || item.category || '', regularPrice: item.regularPrice ?? '', offerPrice: item.offerPrice ?? '', minimumPreparationMinutes: item.minimumPreparationMinutes ?? 15, image: null, availableSizes: item.availableSizes || [], sizePricing: item.sizePricing || [], dietary: item.dietary || [], spicyLevels: item.spicyLevels || [], mealTimes: item.mealTimes || [], isAvailable: item.isAvailable, isFeatured: item.isFeatured, isBestSeller: item.isBestSeller }); setShowItemForm(true) }}>Edit</button>
                    <button type="button" className="danger" onClick={() => remove(`/menu/manage/items/${item._id}`, 'Delete this food item?')}>Delete</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!loading && !filteredItems.length && <p className="admin-empty">No food items found.</p>}
          {totalItemPages > 1 && <div className="menu-pagination">
            <button type="button" disabled={itemPage === 1} onClick={() => setItemPage((page) => page - 1)}>Previous</button>
            <span>Page {itemPage} of {totalItemPages}</span>
            <button type="button" disabled={itemPage === totalItemPages} onClick={() => setItemPage((page) => page + 1)}>Next</button>
          </div>}
        </section>
      </div>
    </div>
  )
}

export default MenuManagementPage
