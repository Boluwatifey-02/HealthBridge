import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Package,
  Search,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Pill,
  Clock3,
  LogOut,
} from 'lucide-react';
import Brand from '../components/Brand';
import api from '../services/api';
import './PharmacyPage.css';

function PharmacyPage({ onBack, onLogout }) {
  const [medicines, setMedicines] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadMedicines = async () => {
      try {
        setIsLoading(true);
        setError('');
        const data = await api.getPharmacy();
        setMedicines(Array.isArray(data) ? data : []);
      } catch (loadError) {
        console.error('Unable to fetch pharmacy inventory:', loadError);
        setError(loadError.message || 'Unable to load pharmacy inventory.');
        setMedicines([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadMedicines();
  }, []);

  const filteredMedicines = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return medicines;
    }

    return medicines.filter(
      (medicine) =>
        String(medicine.name || '').toLowerCase().includes(query) ||
        String(medicine.category || '').toLowerCase().includes(query) ||
        String(medicine.id || '').toLowerCase().includes(query),
    );
  }, [medicines, searchTerm]);

  const totalItems = medicines.length;
  const lowStockItems = medicines.filter(
    (medicine) => Number(medicine.stock) <= Number(medicine.reorderLevel),
  ).length;
  const totalUnits = medicines.reduce(
    (total, medicine) => total + Number(medicine.stock || 0),
    0,
  );

  const handleAddMedicine = async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const stock = Number(formData.get('stock') || 0);
    const reorderLevel = Number(formData.get('reorderLevel') || 0);
    const unit = String(formData.get('unit') || '').trim();
    const category = String(formData.get('category') || 'General').trim();
    const name = String(formData.get('name') || '').trim();

    if (!name) {
      setError('Medicine name is required.');
      return;
    }

    try {
      setError('');
      const created = await api.createMedicine({
        name,
        category,
        quantity: stock,
        unit,
        reorderLevel,
      });

      setMedicines((currentMedicines) => [created, ...currentMedicines]);
      setShowForm(false);
      form.reset();
    } catch (createError) {
      console.error('Unable to add medicine through backend:', createError);
      setError(createError.message || 'Unable to add medicine to the database.');
    }
  };

  return (
    <main className="pharmacy-page">
      <header className="pharmacy-header">
        <div className="pharmacy-header-inner">
          <button
            type="button"
            className="pharmacy-back-button"
            onClick={onBack}
          >
            <ArrowLeft size={17} />
            Back to Dashboard
          </button>

          <Brand />

          {onLogout && (
            <button
              type="button"
              className="pharmacy-back-button"
              onClick={onLogout}
            >
              <LogOut size={17} />
              Log out
            </button>
          )}
        </div>
      </header>

      <div className="pharmacy-container">
        <div className="pharmacy-heading">
          <div>
            <span className="pharmacy-label">PHARMACY MANAGEMENT</span>
            <h1>Pharmacy inventory</h1>
            <p>
              Manage medicines, monitor stock levels and keep prescriptions
              connected to available inventory.
            </p>
          </div>

          <button
            type="button"
            className="pharmacy-add-button"
            onClick={() => setShowForm((value) => !value)}
          >
            <Plus size={17} />
            Add medicine
          </button>
        </div>

        <section className="pharmacy-stats">
          <article className="pharmacy-stat-card">
            <div className="pharmacy-stat-icon">
              <Package size={20} />
            </div>
            <div>
              <span>Total medicines</span>
              <strong>{totalItems}</strong>
            </div>
          </article>

          <article className="pharmacy-stat-card">
            <div className="pharmacy-stat-icon">
              <Pill size={20} />
            </div>
            <div>
              <span>Total units</span>
              <strong>{totalUnits}</strong>
            </div>
          </article>

          <article className="pharmacy-stat-card pharmacy-stat-warning">
            <div className="pharmacy-stat-icon">
              <AlertTriangle size={20} />
            </div>
            <div>
              <span>Low stock</span>
              <strong>{lowStockItems}</strong>
            </div>
          </article>

          <article className="pharmacy-stat-card">
            <div className="pharmacy-stat-icon">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <span>Inventory status</span>
              <strong>Active</strong>
            </div>
          </article>
        </section>

        {showForm && (
          <form className="pharmacy-form" onSubmit={handleAddMedicine}>
            <div className="pharmacy-form-header">
              <div>
                <span className="pharmacy-label">NEW INVENTORY ITEM</span>
                <h2>Add medicine</h2>
              </div>
            </div>

            <div className="pharmacy-form-grid">
              <div className="pharmacy-field">
                <label htmlFor="medicine-name">Medicine name</label>
                <input
                  id="medicine-name"
                  name="name"
                  type="text"
                  placeholder="e.g. Ibuprofen 400mg"
                  required
                />
              </div>

              <div className="pharmacy-field">
                <label htmlFor="medicine-category">Category</label>
                <select
                  id="medicine-category"
                  name="category"
                  defaultValue=""
                  required
                >
                  <option value="" disabled>
                    Select category
                  </option>
                  <option value="Pain Relief">Pain Relief</option>
                  <option value="Antibiotic">Antibiotic</option>
                  <option value="Antimalarial">Antimalarial</option>
                  <option value="Diabetes">Diabetes</option>
                  <option value="Respiratory">Respiratory</option>
                  <option value="Allergy">Allergy</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="pharmacy-field">
                <label htmlFor="medicine-stock">Current stock</label>
                <input
                  id="medicine-stock"
                  name="stock"
                  type="number"
                  min="0"
                  placeholder="0"
                  required
                />
              </div>

              <div className="pharmacy-field">
                <label htmlFor="medicine-unit">Unit</label>
                <select
                  id="medicine-unit"
                  name="unit"
                  defaultValue=""
                  required
                >
                  <option value="" disabled>
                    Select unit
                  </option>
                  <option value="tablets">Tablets</option>
                  <option value="capsules">Capsules</option>
                  <option value="packs">Packs</option>
                  <option value="bottles">Bottles</option>
                  <option value="inhalers">Inhalers</option>
                  <option value="units">Units</option>
                </select>
              </div>

              <div className="pharmacy-field">
                <label htmlFor="medicine-reorder">Reorder level</label>
                <input
                  id="medicine-reorder"
                  name="reorderLevel"
                  type="number"
                  min="0"
                  placeholder="e.g. 30"
                  required
                />
              </div>
            </div>

            <div className="pharmacy-form-actions">
              <button
                type="button"
                className="pharmacy-cancel-button"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>

              <button type="submit" className="pharmacy-save-button">
                <Plus size={17} />
                Add medicine
              </button>
            </div>
          </form>
        )}

        <section className="pharmacy-inventory-card">
          <div className="pharmacy-inventory-header">
            <div>
              <span className="pharmacy-label">INVENTORY</span>
              <h2>Medicine stock</h2>
            </div>

            <div className="pharmacy-search">
              <Search size={17} />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search medicines..."
                aria-label="Search medicines"
              />
            </div>
          </div>

          <div className="pharmacy-table-wrapper">
            {isLoading && (
              <div className="pharmacy-empty-state">
                <Clock3 size={20} />
                <p>Loading pharmacy inventory...</p>
              </div>
            )}

            {!isLoading && error && (
              <div className="pharmacy-empty-state">
                <AlertTriangle size={20} />
                <p>{error}</p>
              </div>
            )}

            {!isLoading && !error && (
              <>
                <table className="pharmacy-table">
                  <thead>
                    <tr>
                      <th>Medicine</th>
                      <th>Category</th>
                      <th>Stock</th>
                      <th>Reorder level</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredMedicines.map((medicine) => (
                      <tr key={medicine.id}>
                        <td>
                          <div className="medicine-name">
                            <div className="medicine-icon">
                              <Pill size={16} />
                            </div>
                            <div>
                              <strong>{medicine.name}</strong>
                              <span>{medicine.id}</span>
                            </div>
                          </div>
                        </td>

                        <td>{medicine.category}</td>

                        <td>
                          <strong>
                            {medicine.stock} {medicine.unit}
                          </strong>
                        </td>

                        <td>
                          {medicine.reorderLevel} {medicine.unit}
                        </td>

                        <td>
                          <span
                            className={
                              medicine.status === 'Low stock'
                                ? 'pharmacy-status low'
                                : 'pharmacy-status'
                            }
                          >
                            {medicine.status === 'Low stock' ? (
                              <AlertTriangle size={14} />
                            ) : (
                              <CheckCircle2 size={14} />
                            )}
                            {medicine.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredMedicines.length === 0 && (
                  <div className="pharmacy-empty-state">
                    <Clock3 size={20} />
                    <p>No medicines match your search.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default PharmacyPage;