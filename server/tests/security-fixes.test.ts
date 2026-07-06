// @ts-nocheck
/**
 * Güvenlik düzeltmeleri için regresyon testleri.
 * Bu testler, kapatılan zafiyetlerin tekrar açılmadığını garanti eder.
 *
 * Kapsanan bulgular:
 *  - K4: Sınav cevap anahtarının (correctIndex) öğrenciye sızması
 *  - K2: recovery-key/generate'in kimlik doğrulamasız çağrılabilmesi
 *  - K2: recovery-key'in tek kullanımlık olmaması
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import * as storage from '../utils/storage.js';
import { hashPassword } from '../utils/crypto.js';
import { generateToken } from '../middleware/auth.js';

describe('Güvenlik Düzeltmeleri', () => {
  let teacherToken;
  let studentToken;

  beforeAll(() => {
    storage.setData('teachers', [{
      id: 'sec_teacher',
      username: 'sec_teacher',
      password: hashPassword('pw', 'sec_teacher'),
      fullName: 'Güvenlik Öğretmeni'
    }]);

    storage.setData('students', [{
      id: 'sec_student',
      studentNumber: '99999',
      password: hashPassword('pw', '99999'),
      fullName: 'Güvenlik Öğrenci',
      className: '10-A',
      ipHistory: []
    }]);

    storage.setData('exams', [{
      id: 'exam_sec',
      title: 'Güvenlik Sınavı',
      isActive: true,
      isQuiz: true,
      targetType: 'all',
      startDate: new Date(Date.now() - 3600000).toISOString(),
      endDate: new Date(Date.now() + 3600000).toISOString(),
      questions: [
        { id: 'q1', text: '2+2?', options: ['3', '4', '5'], correctIndex: 1 },
        { id: 'q2', text: 'Başkent?', options: ['İzmir', 'Ankara'], correctIndex: 1 }
      ]
    }]);

    teacherToken = generateToken({ id: 'sec_teacher', userType: 'teacher', username: 'sec_teacher' });
    studentToken = generateToken({ id: 'sec_student', userType: 'student', studentNumber: '99999' });
  });

  describe('K4: Sınav cevap anahtarı sızıntısı', () => {
    it('öğrenciye giden sınavda correctIndex OLMAMALI (GET /api/exams)', async () => {
      const res = await request(app)
        .get('/api/exams')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      const exam = res.body.exams.find(e => e.id === 'exam_sec');
      expect(exam).toBeDefined();
      expect(exam.questions.length).toBe(2);
      exam.questions.forEach(q => {
        expect(q.correctIndex).toBeUndefined();
        expect(q.options).toBeDefined(); // sorular hâlâ görünür
      });
    });

    it('öğrenciye giden tekil sınavda correctIndex OLMAMALI (GET /api/exams/:id)', async () => {
      const res = await request(app)
        .get('/api/exams/exam_sec')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      res.body.exam.questions.forEach(q => {
        expect(q.correctIndex).toBeUndefined();
      });
    });

    it('öğretmene giden sınavda correctIndex KORUNMALI', async () => {
      const res = await request(app)
        .get('/api/exams')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      const exam = res.body.exams.find(e => e.id === 'exam_sec');
      expect(exam.questions[0].correctIndex).toBe(1);
      expect(exam.questions[1].correctIndex).toBe(1);
    });
  });

  describe('K2: Kurtarma anahtarı hesap ele geçirme', () => {
    it('recovery-key/generate kimlik doğrulamasız REDDEDİLMELİ', async () => {
      const res = await request(app)
        .post('/api/auth/recovery-key/generate')
        .send({ username: 'sec_teacher' });

      expect([401, 403]).toContain(res.status);
    });

    it('bir öğretmen BAŞKA hesap için anahtar üretememeli', async () => {
      const otherToken = generateToken({ id: 'x', userType: 'teacher', username: 'baskasi' });
      const res = await request(app)
        .post('/api/auth/recovery-key/generate')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ username: 'sec_teacher' });

      expect(res.status).toBe(403);
    });

    it('kurtarma anahtarı tek kullanımlık olmalı', async () => {
      // 1) Kendi hesabı için anahtar üret
      const genRes = await request(app)
        .post('/api/auth/recovery-key/generate')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ username: 'sec_teacher' });
      expect(genRes.status).toBe(200);
      const key = genRes.body.recoveryKey;
      expect(key).toBeTruthy();

      // 2) İlk sıfırlama başarılı olmalı
      const reset1 = await request(app)
        .post('/api/auth/recovery-key/reset')
        .send({ username: 'sec_teacher', recoveryKey: key, newPassword: 'yeni_sifre_1' });
      expect(reset1.status).toBe(200);

      // 3) Aynı anahtarla ikinci sıfırlama REDDEDİLMELİ (tek kullanımlık)
      const reset2 = await request(app)
        .post('/api/auth/recovery-key/reset')
        .send({ username: 'sec_teacher', recoveryKey: key, newPassword: 'yeni_sifre_2' });
      expect(reset2.status).not.toBe(200);
    });
  });
});
