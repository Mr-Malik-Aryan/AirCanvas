// pages/index.tsx
import Head from 'next/head';
import HandDetection from '../components/HandDetection';

export default function Home() {
  return (
    <div>
      <Head>
        <title>Hand Detection with MediaPipe</title>
      </Head>
      <main className='w-full  '>
      
        <HandDetection />
   
      </main>
    </div>
  );
}
