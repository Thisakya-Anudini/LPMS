const PNG_DATA_URL_PREFIX = 'data:image/png;base64,';

const normalizeDisplayValue = (value) => {
  const normalized = String(value ?? '').trim();
  return normalized && !['-', 'n/a', 'na', 'null', 'undefined'].includes(normalized.toLowerCase())
    ? normalized
    : null;
};

const formatDurationValue = (value) => normalizeDisplayValue(value) || '-';

const normalizeNumber = (value) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const buildCourseRows = (courses) => {
  const sortedCourses = [...courses].sort((a, b) =>
    a.stageOrder - b.stageOrder || a.order - b.order || a.title.localeCompare(b.title)
  );
  const rows = [];
  let lastStageTitle = null;

  for (const course of sortedCourses) {
    if (course.stageTitle !== lastStageTitle) {
      rows.push({ type: 'stage', title: course.stageTitle, duration: '' });
      lastStageTitle = course.stageTitle;
    }
    rows.push({ type: 'course', title: course.title, duration: course.duration });
  }

  return rows;
};

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
      duration: formatDurationValue(course?.duration),
      stageTitle: normalizeDisplayValue(course?.stageTitle) || 'Learning Path Courses',
      stageOrder: normalizeNumber(course?.stageOrder),
      order: normalizeNumber(course?.order)
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
  const footerTop = pageHeight - 124;

  const drawPageFrame = () => {
    doc.rect(28, 28, pageWidth - 56, pageHeight - 56).lineWidth(1.5).stroke('#1d4ed8');
  };

  const drawSignatureFooter = (top) => {
    doc.font('Helvetica').fontSize(11).fillColor('#334155').text(`Awarded on ${finishedDateText}`, leftMargin + 12, top, {
      width: 240
    });
    doc.text(`Certificate No: ${certificateNumber}`, leftMargin + 12, top + 18, {
      width: 240
    });

    const signatureBlockWidth = 200;
    const signatureX = pageWidth - rightMargin - signatureBlockWidth;
    const signatureImageTop = top - 12;
    const signatureLineY = top + 50;

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
  };

  const drawCourseColumn = ({
    rows,
    x,
    y,
    width,
    headerHeight,
    rowHeight,
    fontSize,
    stageFontSize
  }) => {
    const durationWidth = Math.max(56, Math.round(width * 0.24));
    const courseWidth = width - durationWidth;

    doc.save().fillColor('#f8fafc').rect(x, y, width, headerHeight).fill().restore();
    doc.lineWidth(0.65).strokeColor('#cbd5e1');
    doc.rect(x, y, width, headerHeight).stroke();
    doc.moveTo(x + courseWidth, y).lineTo(x + courseWidth, y + headerHeight).stroke();
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a').text('Stages and Courses', x + 6, y + 5, {
      width: courseWidth - 10,
      height: headerHeight - 4,
      ellipsis: true
    });
    doc.text('Duration', x + courseWidth + 5, y + 5, {
      width: durationWidth - 10,
      height: headerHeight - 4,
      align: 'right',
      ellipsis: true
    });

    let rowTop = y + headerHeight;
    rows.forEach((row, index) => {
      const isStage = row.type === 'stage';
      doc.save().fillColor(isStage ? '#e0f2fe' : index % 2 === 0 ? '#ffffff' : '#f8fafc').rect(x, rowTop, width, rowHeight).fill().restore();
      doc.lineWidth(0.35).strokeColor(isStage ? '#bae6fd' : '#e2e8f0');
      doc.moveTo(x, rowTop).lineTo(x + width, rowTop).stroke();
      if (!isStage) {
        doc.moveTo(x + courseWidth, rowTop).lineTo(x + courseWidth, rowTop + rowHeight).stroke();
      }

      if (isStage) {
        doc.font('Helvetica-Bold').fontSize(stageFontSize).fillColor('#075985').text(row.title, x + 6, rowTop + 2.5, {
          width: width - 12,
          height: rowHeight - 3,
          ellipsis: true
        });
      } else {
        doc.font('Helvetica').fontSize(fontSize).fillColor('#334155').text(row.title, x + 6, rowTop + 2.5, {
          width: courseWidth - 10,
          height: rowHeight - 3,
          ellipsis: true
        });
        doc.text(row.duration, x + courseWidth + 5, rowTop + 2.5, {
          width: durationWidth - 10,
          height: rowHeight - 3,
          align: 'right',
          ellipsis: true
        });
      }
      rowTop += rowHeight;
    });

    doc.lineWidth(0.65).strokeColor('#cbd5e1').rect(x, y, width, headerHeight + rows.length * rowHeight).stroke();
  };

  drawPageFrame();

  const titleText = `${String(certificateTitle || '').toUpperCase()} CERTIFICATE`;
  const titleFontSize = titleText.length > 58 ? 21 : titleText.length > 44 ? 23 : 26;
  doc.font('Helvetica-Bold').fontSize(titleFontSize).fillColor('#0f172a').text(
    titleText,
    leftMargin,
    56,
    {
      align: 'center',
      width: contentWidth
    }
  );

  doc.moveDown(0.75);
  doc.font('Helvetica').fontSize(11.5).fillColor('#475569').text('This certificate is awarded to', {
    align: 'center',
    width: contentWidth
  });
  doc.moveDown(0.2);
  doc.font('Helvetica-Bold').fontSize(21).fillColor('#0f172a').text(learnerName || '-', {
    align: 'center',
    width: contentWidth
  });
  doc.moveDown(0.1);
  doc.font('Helvetica').fontSize(10.5).fillColor('#64748b').text(`Learner ID: ${learnerIdentifier}`, {
    align: 'center',
    width: contentWidth
  });
  doc.moveDown(0.55);

  doc.font('Helvetica').fontSize(11).fillColor('#475569').text(
    'On successful completion of the following learning path stages and courses',
    {
      align: 'center',
      width: contentWidth
    }
  );
  doc.moveDown(0.5);

  const courseRows = buildCourseRows(normalizedCourses);
  const tableTop = doc.y;
  const durationY = footerTop - 28;
  const availableTableHeight = Math.max(150, durationY - tableTop - 8);
  const headerHeight = 18;
  const columnCount = courseRows.length > 24 ? 2 : 1;
  const rowsPerColumn = Math.max(1, Math.ceil(Math.max(courseRows.length, 1) / columnCount));
  const rowHeight = clamp((availableTableHeight - headerHeight) / rowsPerColumn, 6.5, courseRows.length > 16 ? 15 : 19);
  const fontSize = clamp(rowHeight - 3.2, 5.2, 9);
  const stageFontSize = clamp(rowHeight - 2.7, 5.5, 9);
  const columnGap = columnCount === 2 ? 12 : 0;
  const columnWidth = (tableWidth - columnGap) / columnCount;

  if (courseRows.length === 0) {
    drawCourseColumn({
      rows: [{ type: 'course', title: '-', duration: '-' }],
      x: tableLeft,
      y: tableTop,
      width: tableWidth,
      headerHeight,
      rowHeight: 22,
      fontSize: 9,
      stageFontSize: 9
    });
  } else {
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const start = columnIndex * rowsPerColumn;
      const end = start + rowsPerColumn;
      const columnRows = courseRows.slice(start, end);
      if (columnRows.length === 0) {
        continue;
      }
      drawCourseColumn({
        rows: columnRows,
        x: tableLeft + columnIndex * (columnWidth + columnGap),
        y: tableTop,
        width: columnWidth,
        headerHeight,
        rowHeight,
        fontSize,
        stageFontSize
      });
    }
  }

  doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#334155').text(
    `Learning Path Duration: ${safeLearningPathDuration}`,
    leftMargin,
    durationY,
    {
      width: contentWidth
    }
  );

  drawSignatureFooter(footerTop);

  doc.end();
};
