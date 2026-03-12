import React, { useCallback, useEffect, useState } from 'react';
import { learningApi } from '../../api/lpmsApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';

type CertificateSettingRow = {
  id: string;
  title: string;
  certificate_signer_name: string | null;
  certificate_signer_title: string | null;
  updated_at: string;
};

export function CertificateCustomizationPage() {
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();

  const [rows, setRows] = useState<CertificateSettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ signerName: '', signerTitle: '' });
  const [saving, setSaving] = useState(false);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }
      const response = await learningApi.getCertificateSettings(token);
      setRows(response.learningPaths);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load certificate settings.', 'error');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, showToast]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const startEdit = (row: CertificateSettingRow) => {
    setEditingId(row.id);
    setForm({
      signerName: row.certificate_signer_name || '',
      signerTitle: row.certificate_signer_title || ''
    });
  };

  const closeEdit = () => {
    setEditingId(null);
    setForm({ signerName: '', signerTitle: '' });
  };

  const save = async () => {
    if (!editingId) {
      return;
    }
    setSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }
      await learningApi.updateCertificateSignature(token, editingId, {
        signerName: form.signerName.trim(),
        signerTitle: form.signerTitle.trim()
      });
      showToast('Certificate signature updated.', 'success');
      closeEdit();
      await loadRows();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update signature.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Certificate Customization</h1>
        <p className="text-slate-500">Set signature name and designation per learning path.</p>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 bg-slate-50">
                <th className="py-2 px-3 font-semibold">Learning Path</th>
                <th className="py-2 px-3 font-semibold">Signature Name</th>
                <th className="py-2 px-3 font-semibold">Signature Title</th>
                <th className="py-2 px-3 font-semibold">Updated</th>
                <th className="py-2 px-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="py-3 px-3 text-slate-500" colSpan={5}>Loading...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="py-3 px-3 text-slate-500" colSpan={5}>No learning paths found.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-2 px-3 font-medium text-slate-900">{row.title}</td>
                    <td className="py-2 px-3">{row.certificate_signer_name || '-'}</td>
                    <td className="py-2 px-3">{row.certificate_signer_title || '-'}</td>
                    <td className="py-2 px-3 text-slate-500">
                      {new Date(row.updated_at).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-3">
                      <Button size="sm" onClick={() => startEdit(row)}>Edit</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {editingId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <Card className="w-full max-w-lg">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Update Certificate Signature</h2>
              <Input
                label="Signer Name"
                value={form.signerName}
                onChange={(event) => setForm((prev) => ({ ...prev, signerName: event.target.value }))}
                required
              />
              <Input
                label="Signer Title"
                value={form.signerTitle}
                onChange={(event) => setForm((prev) => ({ ...prev, signerTitle: event.target.value }))}
                required
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeEdit}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  isLoading={saving}
                  onClick={save}
                  disabled={!form.signerName.trim() || !form.signerTitle.trim()}
                >
                  Save
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
