import React, { useCallback, useEffect, useRef, useState } from 'react';
import { learnerApi } from '../../api/lpmsApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';

type CertificateRow = {
  id: string;
  scope: 'STAGE' | 'FULL';
  issued_at: string;
  learning_path_id: string;
  learning_path_title: string;
  learning_path_description: string;
  learning_path_duration: string;
  learner_name: string;
  learner_email: string;
  completed_at: string | null;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

export function LearnerCertificatesPage() {
  const { getAccessToken } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [previewState, setPreviewState] = useState<{
    title: string;
    url: string | null;
    error: string | null;
  } | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const revokePreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      window.URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      const response = await learnerApi.getCertificates(token);
      setCertificates(response.certificates);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load certificates.', 'error');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => () => revokePreviewUrl(), [revokePreviewUrl]);

  const handleDownload = async (certificate: CertificateRow) => {
    try {
      setDownloadingId(certificate.id);
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }

      const blob = await learnerApi.downloadCertificate(token, certificate.id);
      const safeTitle = certificate.learning_path_title.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
      downloadBlob(blob, `certificate_${safeTitle}_${certificate.id}.pdf`);
      showToast('Certificate downloaded.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to download certificate.', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreview = async (certificate: CertificateRow) => {
    try {
      setPreviewingId(certificate.id);
      revokePreviewUrl();
      setPreviewState({
        title: certificate.learning_path_title,
        url: null,
        error: null
      });

      const token = await getAccessToken();
      if (!token) {
        setPreviewState({
          title: certificate.learning_path_title,
          url: null,
          error: 'Session expired. Please login again.'
        });
        return;
      }

      const blob = await learnerApi.downloadCertificate(token, certificate.id);
      const previewUrl = window.URL.createObjectURL(blob);
      previewUrlRef.current = previewUrl;
      setPreviewState({
        title: certificate.learning_path_title,
        url: previewUrl,
        error: null
      });
    } catch (err) {
      setPreviewState({
        title: certificate.learning_path_title,
        url: null,
        error: err instanceof Error ? err.message : 'Failed to load certificate preview.'
      });
    } finally {
      setPreviewingId(null);
    }
  };

  const closePreview = () => {
    revokePreviewUrl();
    setPreviewState(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Certificates</h1>
        <p className="text-slate-500">
          Certificates are generated when your learning path progress reaches 100%.
        </p>
      </div>

      <Card title="My Certificates">
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-slate-500">Loading certificates...</p>
          ) : certificates.length === 0 ? (
            <p className="text-sm text-slate-500">No certificates generated yet.</p>
          ) : (
            certificates.map((certificate) => (
              <div
                key={certificate.id}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div>
                  <p className="font-semibold text-slate-900">{certificate.learning_path_title}</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Learner: {certificate.learner_name} ({certificate.learner_email})
                  </p>
                  <p className="text-xs text-slate-600">
                    Finished: {new Date(certificate.completed_at || certificate.issued_at).toLocaleDateString()}
                    {' | '}Issued: {new Date(certificate.issued_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-slate-600">
                    Duration: {certificate.learning_path_duration || '-'} | Scope: {certificate.scope}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handlePreview(certificate)}
                    isLoading={previewingId === certificate.id}
                  >
                    Preview
                  </Button>
                  <Button
                    onClick={() => handleDownload(certificate)}
                    isLoading={downloadingId === certificate.id}
                  >
                    Download Certificate
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {previewState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <Card className="max-h-full w-full max-w-6xl overflow-y-auto">
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Certificate Preview</h2>
                  <p className="text-sm text-slate-500">
                    Preview for <span className="font-medium text-slate-700">{previewState.title}</span>.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={closePreview}>
                  Close
                </Button>
              </div>

              {previewState.error ? (
                <div className="flex h-[70vh] items-center justify-center rounded-lg border border-red-200 bg-red-50 px-6 text-sm text-red-600">
                  {previewState.error}
                </div>
              ) : previewState.url ? (
                <iframe
                  src={previewState.url}
                  title={`Certificate preview for ${previewState.title}`}
                  className="h-[70vh] w-full rounded-lg border border-slate-200"
                />
              ) : (
                <div className="flex h-[70vh] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-500">
                  Generating certificate preview...
                </div>
              )}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
