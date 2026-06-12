const PNG_DATA_URL_PREFIX = 'data:image/png;base64,';

const normalizeDisplayValue = (value) => {
  const normalized = String(value ?? '').trim();
  return normalized && !['-', 'n/a', 'na', 'null', 'undefined'].includes(normalized.toLowerCase())
    ? normalized
    : null;
};

const formatDurationValue = (value) => normalizeDisplayValue(value) || '-';

export const renderCertificatePdf = async ({
  res,
  filename,
  certificateTitle,
  learnerName,
  learnerIdentifier,
  finishedDate,
  learningPathDuration,
  signerName,
  signerTitle,
  signaturePngDataUrl,
  certificateNumber,
  courses
}) => {
  let PDFDocument;
  try {
    ({ default: PDFDocument } = await import('pdfkit'));
  } catch {
    const error = new Error('PDF generation library is not installed. Run npm install in server.');
    error.code = 'PDF_ENGINE_NOT_AVAILABLE';
    throw error;
  }

  const safeFinishedDate = finishedDate || new Date();
  const finishedDateText = new Date(safeFinishedDate).toLocaleDateString();
  const safeSignerName = String(signerName || '').trim() || 'Learning Administrator';
  const safeSignerTitle = String(signerTitle || '').trim() || 'LPMS';
  const safeSignaturePngDataUrl = String(signaturePngDataUrl || '').trim();
  const normalizedCourses = Array.isArray(courses)
    ? courses.map((course) => ({
      title: normalizeDisplayValue(course?.title) || 'Course',
      duration: formatDurationValue(course?.duration)
    }))
    : [];
  const safeLearningPathDuration = formatDurationValue(learningPathDuration);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  doc.pipe(res);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const leftMargin = 42;
  const rightMargin = 42;
  const contentWidth = pageWidth - leftMargin - rightMargin;
  const tableLeft = leftMargin + 12;
  const tableWidth = contentWidth - 24;
  const courseColWidth = Math.round(tableWidth * 0.72);
  const durationColWidth = tableWidth - courseColWidth;
  const bottomY = pageHeight - 124;

  doc.rect(28, 28, pageWidth - 56, pageHeight - 56).lineWidth(1.5).stroke('#1d4ed8');

  const titleText = `${String(certificateTitle || '').toUpperCase()} CERTIFICATE`;
  const titleFontSize = titleText.length > 58 ? 22 : titleText.length > 44 ? 24 : 27;
  doc.font('Helvetica-Bold').fontSize(titleFontSize).fillColor('#0f172a').text(
    titleText,
    leftMargin,
    58,
    {
      align: 'center',
      width: contentWidth
    }
  );

  doc.moveDown(1.0);
  doc.font('Helvetica').fontSize(12).fillColor('#475569').text('This certificate is awarded to', {
    align: 'center',
    width: contentWidth
  });
  doc.moveDown(0.25);
  doc.font('Helvetica-Bold').fontSize(22).fillColor('#0f172a').text(learnerName || '-', {
    align: 'center',
    width: contentWidth
  });
  doc.moveDown(0.15);
  doc.font('Helvetica').fontSize(11).fillColor('#64748b').text(`Learner ID: ${learnerIdentifier}`, {
    align: 'center',
    width: contentWidth
  });
  doc.moveDown(0.8);

  doc.font('Helvetica').fontSize(12).fillColor('#475569').text(
    'On successful completion of following e-learning courses',
    {
      align: 'center',
      width: contentWidth
    }
  );
  doc.moveDown(0.8);

  const tableTop = doc.y;
  const rowHeight = normalizedCourses.length > 12 ? 18 : 21;
  const tableBottomLimit = bottomY - 28;
  const maxBodyRows = Math.max(1, Math.floor((tableBottomLimit - tableTop - rowHeight) / rowHeight));
  const hasOverflowCourses = normalizedCourses.length > maxBodyRows;
  const visibleCourseCount = hasOverflowCourses ? Math.max(0, maxBodyRows - 1) : normalizedCourses.length;
  const visibleCourses = normalizedCourses.slice(0, visibleCourseCount);
  const hiddenCourseCount = normalizedCourses.length - visibleCourseCount;

  doc.save().fillColor('#f8fafc').rect(tableLeft, tableTop, tableWidth, rowHeight).fill().restore();
  doc.lineWidth(0.75).strokeColor('#cbd5e1');
  doc.moveTo(tableLeft, tableTop).lineTo(tableLeft + tableWidth, tableTop).stroke();
  doc.moveTo(tableLeft, tableTop + rowHeight).lineTo(tableLeft + tableWidth, tableTop + rowHeight).stroke();
  doc.moveTo(tableLeft + courseColWidth, tableTop).lineTo(tableLeft + courseColWidth, tableTop + rowHeight).stroke();

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text('Courses', tableLeft + 8, tableTop + 6, {
    width: courseColWidth - 12
  });
  doc.text('Duration (hours)', tableLeft + courseColWidth + 8, tableTop + 6, {
    width: durationColWidth - 12,
    align: 'right'
  });

  let currentRowTop = tableTop + rowHeight;

  if (normalizedCourses.length === 0) {
    doc.font('Helvetica').fontSize(11).fillColor('#475569').text('-', tableLeft + 8, currentRowTop + 6, {
      width: tableWidth - 16
    });
    currentRowTop += rowHeight;
  } else {
    for (const course of visibleCourses) {
      doc.save().fillColor('#ffffff').rect(tableLeft, currentRowTop, tableWidth, rowHeight).fill().restore();
      doc.lineWidth(0.5).strokeColor('#e2e8f0');
      doc.moveTo(tableLeft, currentRowTop).lineTo(tableLeft + tableWidth, currentRowTop).stroke();
      doc.moveTo(tableLeft + courseColWidth, currentRowTop).lineTo(tableLeft + courseColWidth, currentRowTop + rowHeight).stroke();

      doc.font('Helvetica').fontSize(9.5).fillColor('#334155').text(course.title, tableLeft + 8, currentRowTop + 5, {
        width: courseColWidth - 12,
        height: rowHeight - 6,
        ellipsis: true
      });
      doc.text(course.duration, tableLeft + courseColWidth + 8, currentRowTop + 5, {
        width: durationColWidth - 12,
        height: rowHeight - 6,
        align: 'right',
        ellipsis: true
      });
      currentRowTop += rowHeight;
    }

    if (hasOverflowCourses) {
      doc.save().fillColor('#ffffff').rect(tableLeft, currentRowTop, tableWidth, rowHeight).fill().restore();
      doc.lineWidth(0.5).strokeColor('#e2e8f0');
      doc.moveTo(tableLeft, currentRowTop).lineTo(tableLeft + tableWidth, currentRowTop).stroke();
      doc.moveTo(tableLeft + courseColWidth, currentRowTop).lineTo(tableLeft + courseColWidth, currentRowTop + rowHeight).stroke();
      doc.font('Helvetica-Oblique').fontSize(9.5).fillColor('#64748b').text(
        `Additional courses included in this learning path: ${hiddenCourseCount}`,
        tableLeft + 8,
        currentRowTop + 5,
        {
          width: courseColWidth - 12,
          height: rowHeight - 6,
          ellipsis: true
        }
      );
      doc.font('Helvetica').fontSize(9.5).fillColor('#64748b').text('-', tableLeft + courseColWidth + 8, currentRowTop + 5, {
        width: durationColWidth - 12,
        height: rowHeight - 6,
        align: 'right'
      });
      currentRowTop += rowHeight;
    }
  }

  doc.moveTo(tableLeft, currentRowTop).lineTo(tableLeft + tableWidth, currentRowTop).stroke();

  doc.y = currentRowTop + 24;
  doc.font('Helvetica').fontSize(11).fillColor('#334155').text(
    `Learning Path Duration: ${safeLearningPathDuration}`,
    leftMargin,
    doc.y,
    {
      width: contentWidth
    }
  );

  doc.font('Helvetica').fontSize(11).fillColor('#334155').text(`Awarded on ${finishedDateText}`, leftMargin + 12, bottomY, {
    width: 240
  });
  doc.text(`Certificate No: ${certificateNumber}`, leftMargin + 12, bottomY + 18, {
    width: 240
  });

  const signatureBlockWidth = 200;
  const signatureX = pageWidth - rightMargin - signatureBlockWidth;
  const signatureImageTop = bottomY - 12;
  const signatureLineY = bottomY + 50;

  if (safeSignaturePngDataUrl.startsWith(PNG_DATA_URL_PREFIX)) {
    try {
      const signatureBuffer = Buffer.from(safeSignaturePngDataUrl.slice(PNG_DATA_URL_PREFIX.length), 'base64');
      doc.image(signatureBuffer, signatureX + 20, signatureImageTop, {
        fit: [signatureBlockWidth - 40, 60],
        align: 'center',
        valign: 'center'
      });
    } catch {
      // Ignore invalid image and fall back to text.
    }
  }

  doc.lineWidth(0.75).strokeColor('#94a3b8').moveTo(signatureX, signatureLineY).lineTo(signatureX + signatureBlockWidth, signatureLineY).stroke();
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text(safeSignerName, signatureX, signatureLineY + 6, {
    width: signatureBlockWidth,
    align: 'center'
  });
  doc.font('Helvetica').fontSize(10).fillColor('#475569').text(safeSignerTitle, signatureX, signatureLineY + 24, {
    width: signatureBlockWidth,
    align: 'center'
  });

  doc.end();
};
