import { Analytics } from '@vercel/analytics/react';
import { PagerDevice } from './pager/PagerDevice';

function App() {
  return (
    <>
      <PagerDevice />
      <Analytics />
    </>
  );
}

export default App;
