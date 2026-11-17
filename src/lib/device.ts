/** 아이폰처럼 작은 터치 화면(애플펜슬을 못 씀): 메모는 손가락으로 쓰고, 잠금은 '손글씨 잠금' */
export function isPhone(): boolean {
  try {
    return matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600;
  } catch {
    return false;
  }
}
