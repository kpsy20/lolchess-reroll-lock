import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';

// Firebase 설정 (환경 변수에서 가져오기)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Firebase 앱 초기화
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  console.error('Firebase 초기화 실패:', error);
  // 개발 환경에서는 더미 앱 생성
  app = null;
}

// Firestore 데이터베이스 가져오기
export const db = app ? getFirestore(app) : null;

// 게임 결과 컬렉션 참조
export const gameResultsCollection = db ? collection(db, 'gameResults') : null;

// Firestore 서비스 함수들
export const firestoreService = {
  // 결과 저장
  async saveResult(result: {
    deck: string;
    spent: number;
    rerollCount: number;
    timeSec: number;
    date: string;
    targets: Record<string, number>;
    overlapMode: 'none' | 'with';
  }): Promise<string> {
    if (!gameResultsCollection) {
      console.warn('Firestore가 초기화되지 않았습니다. 결과를 저장할 수 없습니다.');
      return 'firebase-not-initialized';
    }
    
    try {
      const docRef = await addDoc(gameResultsCollection, {
        deck: result.deck,
        spent: result.spent,
        rerollCount: result.rerollCount,
        timeSec: result.timeSec,
        date: result.date,
        targets: result.targets,
        overlapMode: result.overlapMode,
        createdAt: new Date()
      });
      return docRef.id;
    } catch (error) {
      console.error('Firestore 저장 실패:', error);
      throw error;
    }
  },

  // 전체 결과 가져오기 (최근 100개, 시간순 정렬)
  async getAllResults(): Promise<Array<{
    id: string;
    deck: string;
    spent: number;
    rerollCount: number;
    timeSec: number;
    date: string;
    targets: Record<string, number>;
    overlapMode?: 'none' | 'with';
    createdAt: Date;
  }>> {
    if (!gameResultsCollection) {
      console.warn('Firestore가 초기화되지 않았습니다. 결과를 가져올 수 없습니다.');
      return [];
    }
    
    try {
      const q = query(gameResultsCollection, orderBy('createdAt', 'desc'), limit(100));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Array<{
        id: string;
        deck: string;
        spent: number;
        rerollCount: number;
        timeSec: number;
        date: string;
        targets: Record<string, number>;
        overlapMode?: 'none' | 'with';
        createdAt: Date;
      }>;
    } catch (error) {
      console.error('Firestore에서 결과 가져오기 실패:', error);
      return [];
    }
  },

  // 특정 덱의 결과만 가져오기
  async getDeckResults(deckName: string): Promise<Array<{
    id: string;
    deck: string;
    spent: number;
    rerollCount: number;
    timeSec: number;
    date: string;
    targets: Record<string, number>;
    overlapMode?: 'none' | 'with';
    createdAt: Date;
  }>> {
    if (!gameResultsCollection) {
      console.warn('Firestore가 초기화되지 않았습니다. 결과를 가져올 수 없습니다.');
      return [];
    }
    
    try {
      const q = query(
        gameResultsCollection, 
        orderBy('createdAt', 'desc'), 
        limit(50)
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(doc => doc.deck === deckName) as Array<{
          id: string;
          deck: string;
          spent: number;
          rerollCount: number;
          timeSec: number;
          date: string;
          targets: Record<string, number>;
          overlapMode?: 'none' | 'with';
          createdAt: Date;
        }>;
    } catch (error) {
      console.error('Firestore에서 덱별 결과 가져오기 실패:', error);
      return [];
    }
  }
};
