export function SettingsPage() {
  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-full overflow-x-hidden">
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">ตั้งค่า</h1>
        <p className="text-sm sm:text-base text-gray-600">จัดการการตั้งค่าระบบ</p>
      </div>

      <div className="max-w-2xl space-y-4 sm:space-y-6">
        <div className="bg-white rounded-lg border p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">ข้อมูลทั่วไป</h2>
          <p className="text-gray-600 text-sm">
            การตั้งค่าเพิ่มเติมจะมาในเวอร์ชันถัดไป
          </p>
        </div>
      </div>
    </div>
  );
}
