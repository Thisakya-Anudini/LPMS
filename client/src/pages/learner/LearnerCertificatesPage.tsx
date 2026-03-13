import React, { useCallback, useEffect, useState } from 'react';
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

type LoadingState = {
  id: string;
  action: 'view' | 'download';
} | null;

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
  const [loadingState, setLoadingState] = useState<LoadingState>(null);
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);

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

  const handleDownload = async (certificate: CertificateRow) => {
    try {
      setLoadingState({ id: certificate.id, action: 'download' });
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }
      const blob = await learnerApi.downloadCertificate(token, certificate.id);
      const safeTitle = `${certificate.learner_name} - ${certificate.learning_path_title} - Certificate`;
      downloadBlob(blob, `${safeTitle}.pdf`);
      showToast('Certificate downloaded.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to download certificate.', 'error');
    } finally {
      setLoadingState(null);
    }
  };

  const handleView = async (certificate: CertificateRow) => {
    try {
      setLoadingState({ id: certificate.id, action: 'view' });
      const token = await getAccessToken();
      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        return;
      }
      const blob = await learnerApi.downloadCertificate(token, certificate.id);
      const pdfUrl = window.URL.createObjectURL(blob);
      const tabTitle = `${certificate.learner_name} - ${certificate.learning_path_title} - Certificate`;

      const html = `<!DOCTYPE html>
<html>
  <head><title>${tabTitle}</title></head>
  <body style="margin:0;padding:0;height:100vh;">
    <embed src="${pdfUrl}" type="application/pdf" width="100%" height="100%" />
  </body>
</html>`;

      const htmlBlob = new Blob([html], { type: 'text/html' });
      const htmlUrl = window.URL.createObjectURL(htmlBlob);
      window.open(htmlUrl, '_blank');
      showToast('Certificate opened in new tab.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to view certificate.', 'error');
    } finally {
      setLoadingState(null);
    }
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
                    Finished:{' '}
                    {new Date(certificate.completed_at || certificate.issued_at).toLocaleDateString()}
                    {' | '}
                    Issued: {new Date(certificate.issued_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-slate-600">
                    Duration: {certificate.learning_path_duration || '-'} | Scope: {certificate.scope}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleView(certificate)}
                    isLoading={
                      loadingState?.id === certificate.id && loadingState?.action === 'view'
                    }
                    disabled={loadingState !== null}
                  >
                    View Certificate
                  </Button>
                  <Button
                    onClick={() => handleDownload(certificate)}
                    isLoading={
                      loadingState?.id === certificate.id && loadingState?.action === 'download'
                    }
                    disabled={loadingState !== null}
                  >
                    Download Certificate
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}