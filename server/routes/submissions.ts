// @ts-nocheck
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getData, setData, generateId } from '../utils/storage.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { addLog } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const router = express.Router();

// Tüm teslimleri getir
/**
 * @swagger
 * /api/submissions:
 *   get:
 *     summary: GET /
 *     tags: [Submissions]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.get('/', (req, res) => {
  try {
    const submissions = getData('submissions') || [];
    res.json({ success: true, submissions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Öğrenci teslimlerini getir
/**
 * @swagger
 * /api/submissions/student/{studentId}:
 *   get:
 *     summary: GET /student/{studentId}
 *     tags: [Submissions]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.get('/student/:studentId', (req, res) => {
  try {
    const { studentId } = req.params;
    const submissions = getData('submissions') || [];
    const studentSubmissions = submissions.filter(s => s.studentId === studentId);
    res.json({ success: true, submissions: studentSubmissions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sınav teslimlerini getir
/**
 * @swagger
 * /api/submissions/exam/{examId}:
 *   get:
 *     summary: GET /exam/{examId}
 *     tags: [Submissions]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.get('/exam/:examId', (req, res) => {
  try {
    const { examId } = req.params;
    const submissions = getData('submissions') || [];
    const examSubmissions = submissions.filter(s => s.examId === examId);
    res.json({ success: true, submissions: examSubmissions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tek teslim getir
/**
 * @swagger
 * /api/submissions/{examId}/{studentId}:
 *   get:
 *     summary: GET /{examId}/{studentId}
 *     tags: [Submissions]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.get('/:examId/:studentId', (req, res) => {
  try {
    const { examId, studentId } = req.params;
    const submissions = getData('submissions') || [];
    const submission = submissions.find(s => s.examId === examId && s.studentId === studentId);

    if (!submission) {
      return res.status(404).json({ success: false, error: 'Teslim bulunamadı' });
    }

    res.json({ success: true, submission });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Teslim oluştur/güncelle (dosya yüklemesi uploads route'unda)
/**
 * @swagger
 * /api/submissions:
 *   post:
 *     summary: POST /
 *     tags: [Submissions]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.post('/', (req, res) => {
  try {
    const {
      examId,
      studentId,
      studentNumber,
      studentName,
      studentClass,
      folderPath,
      fileName,
      fileSize,
      fileType,
      filePath,
      fileHash,
      clientIp
    } = req.body;

    const submissions = getData('submissions') || [];

    // Aynı dosya hash'i ile daha önce yüklenmiş mi kontrol et (duplicate check)
    const duplicateFile = submissions.find(
      s => s.examId === examId && s.studentId === studentId && s.fileHash === fileHash
    );

    if (duplicateFile) {
      // Aynı dosya zaten yüklü, güncelle
      const existingIndex = submissions.findIndex(s => s.id === duplicateFile.id);
      const existing = submissions[existingIndex];

      existing.editHistory = existing.editHistory || [];
      existing.editHistory.push({
        version: existing.editHistory.length + 1,
        fileName: existing.fileName,
        fileHash: existing.fileHash,
        editedAt: new Date().toISOString(),
        reason: 'Dosya güncellendi'
      });

      existing.fileName = fileName;
      existing.fileSize = fileSize;
      existing.fileType = fileType;
      existing.filePath = filePath;
      existing.fileHash = fileHash;
      existing.updatedAt = new Date().toISOString();
      existing.ipAddress = clientIp || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      existing.isLocked = false;
      existing.isReady = false;

      setData('submissions', submissions);
      res.json({ success: true, submission: existing, isUpdate: true });
    } else {
      // Yeni teslim - her dosya için ayrı submission
      const newSubmission = {
        id: generateId(),
        examId,
        studentId,
        studentNumber,
        studentName,
        studentClass,
        folderPath,
        fileName,
        fileSize,
        fileType,
        filePath,
        fileHash,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ipAddress: clientIp || 'Bilinmiyor',
        isLocked: false,
        isReady: false,
        grade: null,
        feedback: null,
        gradedAt: null,
        gradedBy: null,
        editHistory: [],
        editRequests: []
      };

      submissions.push(newSubmission);
      setData('submissions', submissions);

      addLog({
        type: 'submission',
        userId: studentId,
        userName: studentName,
        role: 'student',
        action: 'Sınav dosyası teslim edildi',
        details: { examId, fileName, fileHash }
      });

      res.json({ success: true, submission: newSubmission, isUpdate: false });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Quiz teslimi oluştur ve otomatik notlandır
/**
 * @swagger
 * /api/submissions/quiz:
 *   post:
 *     summary: POST /quiz
 *     tags: [Submissions]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.post('/quiz', (req, res) => {
  try {
    const {
      examId,
      studentId,
      studentNumber,
      studentName,
      studentClass,
      answers, // [{questionId, selectedIndex}]
      clientIp
    } = req.body;

    const exams = getData('exams') || [];
    const exam = exams.find(e => e.id === examId);

    if (!exam || !exam.isQuiz) {
      return res.status(400).json({ success: false, error: 'Geçersiz sınav veya sınav bir quiz değil!' });
    }

    const submissions = getData('submissions') || [];

    // Daha önce teslim edilmiş mi kontrol et
    const existingSubmission = submissions.find(
      s => s.examId === examId && s.studentId === studentId && s.status !== 'edit_granted'
    );

    if (existingSubmission && !existingSubmission.isLocked === false) {
      // Eğer kilitli değilse veya düzenleme izni varsa güncellenebilir 
      // Ama genelde quizler tek atımlıktır, isteğe göre değiştirilebilir
    }

    // Puan hesapla
    let totalPoints = 0;
    let earnedPoints = 0;
    const processedAnswers = exam.questions.map(q => {
      const studentAnswer = answers.find(a => String(a.questionId) === String(q.id));
      const isCorrect = studentAnswer && studentAnswer.selectedIndex === q.correctIndex;

      totalPoints += (q.points || 10);
      if (isCorrect) earnedPoints += (q.points || 10);

      return {
        questionId: q.id,
        selectedIndex: studentAnswer ? studentAnswer.selectedIndex : null,
        isCorrect
      };
    });

    let finalGrade = null;
    let feedback = 'Beklemede';
    let status = 'ungraded';

    if (exam.autoGrading !== false) {
      finalGrade = Math.round((earnedPoints / totalPoints) * 100);
      feedback = `Otomatik notlandırma: ${earnedPoints}/${totalPoints}`;
      status = 'graded';
    }

    const newSubmission = {
      id: generateId(),
      examId,
      studentId,
      studentNumber,
      studentName,
      studentClass,
      type: 'quiz',
      answers: processedAnswers,
      earnedPoints,
      totalPoints,
      grade: finalGrade,
      feedback,
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ipAddress: clientIp || 'Bilinmiyor',
      isLocked: true, // Quiz teslim edildiğinde otomatik kilitlenir
      isReady: true,
      status // autoGrading durumuna göre 'graded' veya 'ungraded'
    };

    submissions.push(newSubmission);
    setData('submissions', submissions);

    addLog({
      type: 'submission',
      userId: studentId,
      userName: studentName,
      role: 'student',
      action: 'Quiz teslim edildi',
      details: { examId, score: finalGrade }
    });

    res.json({ success: true, submission: newSubmission, score: finalGrade });
  } catch (error) {
    console.error('Quiz submission error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Klasik sınav teslimi oluştur
/**
 * @swagger
 * /api/submissions/classic:
 *   post:
 *     summary: POST /classic
 *     tags: [Submissions]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.post('/classic', (req, res) => {
  try {
    const {
      examId,
      studentId,
      studentNumber,
      studentName,
      studentClass,
      answers, // [{text: "Cevap 1"}, ...]
      clientIp
    } = req.body;

    const exams = getData('exams') || [];
    const exam = exams.find(e => e.id === examId);

    if (!exam) {
      return res.status(400).json({ success: false, error: 'Geçersiz sınav!' });
    }

    const submissions = getData('submissions') || [];

    // Daha önce teslim edilmiş mi kontrol et
    const existingSubmissionIndex = submissions.findIndex(
      s => s.examId === examId && s.studentId === studentId && s.status !== 'edit_granted'
    );

    const processedAnswers = answers.map((a, index) => ({
      questionIndex: index + 1,
      text: a.text
    }));

    if (existingSubmissionIndex !== -1) {
      const existing = submissions[existingSubmissionIndex];
      // Kilitliyse güncellemeye izin verme
      if (existing.isLocked) {
        return res.status(400).json({ success: false, error: 'Bu sınav teslimi kilitlenmiştir, güncellenemez.' });
      }

      existing.answers = processedAnswers;
      existing.updatedAt = new Date().toISOString();
      existing.ipAddress = clientIp || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

      setData('submissions', submissions);
      return res.json({ success: true, submission: existing, isUpdate: true });
    }

    const newSubmission = {
      id: generateId(),
      examId,
      studentId,
      studentNumber,
      studentName,
      studentClass,
      type: 'classic',
      answers: processedAnswers,
      grade: null,
      feedback: 'Beklemede',
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ipAddress: clientIp || 'Bilinmiyor',
      isLocked: false,
      isReady: false,
      status: 'ungraded'
    };

    submissions.push(newSubmission);
    setData('submissions', submissions);

    addLog({
      type: 'submission',
      userId: studentId,
      userName: studentName,
      role: 'student',
      action: 'Klasik sınav teslim edildi',
      details: { examId }
    });

    res.json({ success: true, submission: newSubmission, isUpdate: false });
  } catch (error) {
    console.error('Classic submission error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Teslimi kilitle
/**
 * @swagger
 * /api/submissions/{id}/lock:
 *   patch:
 *     summary: PATCH /{id}/lock
 *     tags: [Submissions]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.patch('/:id/lock', (req, res) => {
  try {
    const { id } = req.params;
    const submissions = getData('submissions') || [];
    const submission = submissions.find(s => s.id === id);

    if (!submission) {
      return res.status(404).json({ success: false, error: 'Teslim bulunamadı' });
    }

    submission.isLocked = true;
    submission.lockedAt = new Date().toISOString();
    setData('submissions', submissions);

    res.json({ success: true, submission });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// "Hazırım" işaretle
/**
 * @swagger
 * /api/submissions/{id}/ready:
 *   patch:
 *     summary: PATCH /{id}/ready
 *     tags: [Submissions]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.patch('/:id/ready', (req, res) => {
  try {
    const { id } = req.params;
    const submissions = getData('submissions') || [];
    const submission = submissions.find(s => s.id === id);

    if (!submission) {
      return res.status(404).json({ success: false, error: 'Teslim bulunamadı' });
    }

    submission.isReady = true;
    submission.isLocked = true;
    submission.readyAt = new Date().toISOString();
    submission.lockedAt = new Date().toISOString();
    setData('submissions', submissions);

    res.json({ success: true, submission });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Not ver
/**
 * @swagger
 * /api/submissions/{id}/grade:
 *   patch:
 *     summary: PATCH /{id}/grade
 *     tags: [Submissions]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.patch('/:id/grade', authorizeRole('teacher'), (req, res) => {
  try {
    const { id } = req.params;
    const { grade, feedback, gradedBy } = req.body;

    const submissions = getData('submissions') || [];
    const submission = submissions.find(s => s.id === id);

    if (!submission) {
      return res.status(404).json({ success: false, error: 'Teslim bulunamadı' });
    }

    const teacherIdToUse = gradedBy || req.user?.id || 'unknown';

    // Her öğretmenin notunu ayrı kaydet
    if (!submission.evaluations) {
      submission.evaluations = [];
    }

    const evalIndex = submission.evaluations.findIndex(e => e.teacherId === teacherIdToUse);
    const newEval = {
      teacherId: teacherIdToUse,
      grade,
      feedback: feedback || '',
      gradedAt: new Date().toISOString()
    };

    if (evalIndex >= 0) {
      submission.evaluations[evalIndex] = newEval;
    } else {
      submission.evaluations.push(newEval);
    }

    // Geriye dönük uyumluluk (legacy) ve genel durum için:
    // Eğer bir öğretmen not verdiyse, genel durum graded olur
    submission.grade = grade;
    submission.feedback = feedback || '';
    submission.status = 'graded';
    submission.gradedAt = new Date().toISOString();
    submission.gradedBy = teacherIdToUse;

    setData('submissions', submissions);

    res.json({ success: true, submission });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Düzenleme izni talebi
/**
 * @swagger
 * /api/submissions/{id}/edit-request:
 *   post:
 *     summary: POST /{id}/edit-request
 *     tags: [Submissions]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.post('/:id/edit-request', (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const submissions = getData('submissions') || [];
    const submission = submissions.find(s => s.id === id);

    if (!submission) {
      return res.status(404).json({ success: false, error: 'Teslim bulunamadı' });
    }

    submission.editRequests = submission.editRequests || [];
    submission.editRequests.push({
      id: generateId(),
      reason,
      requestedAt: new Date().toISOString(),
      status: 'pending',
      response: null,
      respondedAt: null
    });

    setData('submissions', submissions);
    res.json({ success: true, submission });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Düzenleme talebini yanıtla
/**
 * @swagger
 * /api/submissions/{id}/edit-request/{requestId}:
 *   patch:
 *     summary: PATCH /{id}/edit-request/{requestId}
 *     tags: [Submissions]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.patch('/:id/edit-request/:requestId', authorizeRole('teacher'), (req, res) => {
  try {
    const { id, requestId } = req.params;
    const { approved, response, respondedBy, editDuration } = req.body;

    const submissions = getData('submissions') || [];
    const submission = submissions.find(s => s.id === id);

    if (!submission) {
      return res.status(404).json({ success: false, error: 'Teslim bulunamadı' });
    }

    const request = submission.editRequests?.find(r => r.id === requestId);
    if (!request) {
      return res.status(404).json({ success: false, error: 'Talep bulunamadı' });
    }

    request.status = approved ? 'approved' : 'rejected';
    request.response = response;
    request.respondedAt = new Date().toISOString();
    request.respondedBy = respondedBy;

    if (approved) {
      const editExpiresAt = new Date(Date.now() + (editDuration || 10) * 60 * 1000).toISOString();
      request.editExpiresAt = editExpiresAt;
      submission.isLocked = false;
      submission.editDeadline = editExpiresAt;
    }

    setData('submissions', submissions);
    res.json({ success: true, submission });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Öğretmen direkt düzenleme izni ver (mevcut dosyaları sil)
/**
 * @swagger
 * /api/submissions/{submissionId}/grant-edit-permission:
 *   post:
 *     summary: POST /{submissionId}/grant-edit-permission
 *     tags: [Submissions]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.post('/:submissionId/grant-edit-permission', authorizeRole('teacher'), (req, res) => {
  try {
    const { submissionId } = req.params;
    const { examId, studentId, note, teacherId } = req.body;

    const submissions = getData('submissions') || [];

    // Bu sınav ve öğrenciye ait tüm submission'ları bul
    const studentSubmissions = submissions.filter(s =>
      s.examId === examId && s.studentId === studentId
    );

    if (studentSubmissions.length === 0) {
      return res.status(404).json({ success: false, error: 'Teslim bulunamadı' });
    }

    // Tüm submission'ları sil
    const remainingSubmissions = submissions.filter(s =>
      !(s.examId === examId && s.studentId === studentId)
    );

    // Dosyaları fiziksel olarak sil
    studentSubmissions.forEach(submission => {
      if (submission.filePath) {
        const fullPath = join(__dirname, '..', submission.filePath);
        if (fs.existsSync(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
            console.log(`Dosya silindi: ${fullPath}`);
          } catch (err) {
            console.error(`Dosya silinemedi: ${fullPath}`, err);
          }
        }
      }
    });

    // Yeni bir "edit permission granted" kaydı oluştur
    const editPermission = {
      id: generateId(),
      examId,
      studentId,
      note: note || 'Öğretmen tarafından düzenleme izni verildi',
      grantedBy: teacherId,
      grantedAt: new Date().toISOString(),
      status: 'edit_granted'
    };

    remainingSubmissions.push(editPermission);
    setData('submissions', remainingSubmissions);

    res.json({
      success: true,
      message: 'Düzenleme izni verildi ve mevcut dosyalar silindi',
      deletedCount: studentSubmissions.length
    });
  } catch (error) {
    console.error('Düzenleme izni verme hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Benzer dosya tespiti (Hash karşılaştırması)
/**
 * @swagger
 * /api/submissions/check-duplicate:
 *   post:
 *     summary: POST /check-duplicate
 *     tags: [Submissions]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.post('/check-duplicate', (req, res) => {
  try {
    const { fileHash, examId, studentId } = req.body;

    if (!fileHash) {
      return res.json({ success: true, hasDuplicate: false, matches: [] });
    }

    const submissions = getData('submissions') || [];

    // Aynı sınav için diğer öğrencilerin gönderimlerini kontrol et
    const matches = submissions.filter(s =>
      s.examId === examId &&
      s.studentId !== studentId &&
      s.fileHash === fileHash
    );

    if (matches.length > 0) {
      return res.json({
        success: true,
        hasDuplicate: true,
        matches: matches.map(m => ({
          studentNumber: m.studentNumber,
          studentName: m.studentName,
          studentClass: m.studentClass,
          fileName: m.fileName,
          fileHash: m.fileHash,
          submittedAt: m.submittedAt
        }))
      });
    }

    res.json({ success: true, hasDuplicate: false, matches: [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sınav bazında benzer dosyaları listele (Öğretmen için)
/**
 * @swagger
 * /api/submissions/exam/{examId}/duplicates:
 *   get:
 *     summary: GET /exam/{examId}/duplicates
 *     tags: [Submissions]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.get('/exam/:examId/duplicates', (req, res) => {
  try {
    const { examId } = req.params;
    const submissions = getData('submissions') || [];

    const examSubmissions = submissions.filter(s => s.examId === examId);

    // Hash gruplarını oluştur
    const hashGroups = {};
    examSubmissions.forEach(sub => {
      if (sub.fileHash) {
        if (!hashGroups[sub.fileHash]) {
          hashGroups[sub.fileHash] = [];
        }
        hashGroups[sub.fileHash].push({
          id: sub.id,
          studentNumber: sub.studentNumber,
          studentName: sub.studentName,
          studentClass: sub.studentClass,
          fileName: sub.fileName,
          fileHash: sub.fileHash,
          submittedAt: sub.submittedAt
        });
      }
    });

    // 2 veya daha fazla öğrencinin aynı dosyayı gönderdiği grupları filtrele
    const duplicates = Object.entries(hashGroups)
      .filter(([hash, students]) => students.length > 1)
      .map(([hash, students]) => ({
        fileHash: hash,
        count: students.length,
        students: students
      }));

    res.json({ success: true, duplicates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Teslimi sil
/**
 * @swagger
 * /api/submissions/{id}:
 *   delete:
 *     summary: DELETE /{id}
 *     tags: [Submissions]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.delete('/:id', authorizeRole('teacher'), (req, res) => {
  try {
    const { id } = req.params;
    const submissions = getData('submissions') || [];

    const submissionIndex = submissions.findIndex(s => s.id === id);

    if (submissionIndex === -1) {
      return res.status(404).json({ success: false, error: 'Teslim bulunamadı' });
    }

    const submission = submissions[submissionIndex];

    // Dosyayı sil
    if (submission.filePath) {
      const fullPath = path.join(__dirname, '..', submission.filePath.replace('/uploads_student/', 'uploads_student/'));

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    // Submission kaydını sil
    submissions.splice(submissionIndex, 1);
    setData('submissions', submissions);

    res.json({ success: true, message: 'Teslim silindi' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Odak kaybı bildirimi kaydet
/**
 * @swagger
 * /api/submissions/focus-violation:
 *   post:
 *     summary: POST /focus-violation
 *     tags: [Submissions]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.post('/focus-violation', (req, res) => {
  try {
    const { examId, studentId } = req.body;
    if (!examId || !studentId) {
      return res.status(400).json({ success: false, error: 'Sınav ID ve Öğrenci ID zorunludur' });
    }

    const submissions = getData('submissions') || [];
    // Öğrencinin bu sınav için bir teslimatı var mı bak
    let submission = submissions.find(s => s.examId === examId && s.studentId === studentId);

    if (!submission) {
      // Eğer henüz teslim oluşturulmamışsa (öğrenci sınavı çözme aşamasında), geçici bir session gibi submissions'a ekleyelim veya 
      // aktif sınav sürecinde olduğunu belirtmek için boş bir submission kaydı açalım.
      const { exams, users } = req.app.get('db') || { exams: [], users: [] };
      const exam = (getData('exams') || []).find(e => e.id === examId);
      const student = (getData('users') || []).find(u => u.id === studentId);

      submission = {
        id: 'sub_' + Math.random().toString(36).substr(2, 9),
        examId,
        studentId,
        studentNumber: student?.number || student?.username || 'Bilinmiyor',
        studentName: student?.name || 'Bilinmiyor',
        studentClass: student?.class || 'Bilinmiyor',
        type: exam?.type || 'classic',
        focusViolationCount: 1,
        focusViolations: [new Date().toISOString()],
        status: 'in_progress', // Henüz tamamlanmadı
        submittedAt: null
      };
      submissions.push(submission);
    } else {
      submission.focusViolationCount = (submission.focusViolationCount || 0) + 1;
      if (!submission.focusViolations) {
        submission.focusViolations = [];
      }
      submission.focusViolations.push(new Date().toISOString());
    }

    setData('submissions', submissions);
    res.json({ success: true, focusViolationCount: submission.focusViolationCount });
  } catch (error) {
    console.error('Focus violation log error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
