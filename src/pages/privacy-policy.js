// pages/privacy-policy.js
import Head from 'next/head';

export default function PrivacyPolicy() {
  const appName = "zyypage-poster"; // Thay đổi tên ứng dụng của bạn
  const contactEmail = "zydang2025@gmail.com"; // Thay đổi email hỗ trợ của bạn
  const websiteUrl = "https://fbposter.vercel.app"; // Thay đổi URL ứng dụng của bạn

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <Head>
        <title>Chính sách quyền riêng tư - {appName}</title>
      </Head>
      <h1 className="text-3xl font-bold mb-6">Chính sách quyền riêng tư cho {appName}</h1>
      <p className="mb-4">Ngày có hiệu lực: 28 tháng 5 năm 2025</p>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-3">1. Thông tin chúng tôi thu thập</h2>
        <p className="mb-2">Khi bạn sử dụng ứng dụng {appName}, chúng tôi có thể thu thập các loại thông tin sau:</p>
        <ul className="list-disc ml-6">
          <li>**Thông tin từ Facebook:** Khi bạn đăng nhập thông qua Facebook, chúng tôi thu thập ID người dùng Facebook của bạn, tên, ảnh đại diện, và danh sách các Fanpage mà bạn quản lý (bao gồm ID Fanpage, tên Fanpage, và token truy cập Fanpage).</li>
          <li>**Nội dung bài viết:** Bất kỳ văn bản và URL hình ảnh bạn nhập vào ứng dụng để đăng lên Facebook hoặc lưu trữ.</li>
          <li>**Thông tin sử dụng:** Dữ liệu về cách bạn tương tác với ứng dụng của chúng tôi.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-3">2. Cách chúng tôi sử dụng thông tin của bạn</h2>
        <p className="mb-2">Chúng tôi sử dụng thông tin thu thập được cho các mục đích sau:</p>
        <ul className="list-disc ml-6">
          <li>Để xác thực bạn với Facebook và cho phép bạn đăng nhập vào ứng dụng.</li>
          <li>Để cho phép bạn xem và chọn các Fanpage mà bạn muốn đăng bài.</li>
          <li>Để đăng các bài viết bạn tạo lên các Fanpage đã chọn.</li>
          <li>Để lưu trữ các bài viết bạn đã tạo để bạn có thể tái sử dụng chúng sau này.</li>
          <li>Để cải thiện chức năng và trải nghiệm người dùng của ứng dụng.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-3">3. Chia sẻ thông tin</h2>
        <p className="mb-2">Chúng tôi không chia sẻ thông tin cá nhân của bạn với bất kỳ bên thứ ba nào ngoại trừ những trường hợp sau:</p>
        <ul className="list-disc ml-6">
          <li>**Với Facebook:** Để thực hiện các hành động mà bạn yêu cầu (ví dụ: đăng bài lên Fanpage), chúng tôi phải gửi thông tin bài viết và token truy cập Fanpage của bạn đến API của Facebook.</li>
          <li>**Tuân thủ pháp luật:** Khi được yêu cầu bởi pháp luật hoặc quy định của chính phủ.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-3">4. Bảo mật dữ liệu</h2>
        <p className="mb-2">Chúng tôi cam kết bảo vệ thông tin của bạn. Chúng tôi thực hiện các biện pháp bảo mật hợp lý (như mã hóa dữ liệu, kiểm soát truy cập) để bảo vệ dữ liệu của bạn khỏi truy cập, sử dụng hoặc tiết lộ trái phép.</p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-3">5. Quyền của bạn</h2>
        <p className="mb-2">Bạn có quyền:</p>
        <ul className="list-disc ml-6">
          <li>Truy cập thông tin cá nhân mà chúng tôi lưu giữ về bạn.</li>
          <li>Yêu cầu sửa đổi hoặc xóa thông tin cá nhân của bạn.</li>
          <li>Rút lại sự đồng ý của bạn đối với việc sử dụng dữ liệu của bạn bất cứ lúc nào (điều này có thể ảnh hưởng đến khả năng sử dụng ứng dụng của bạn).</li>
        </ul>
        <p className="mt-2">Để thực hiện các quyền này, vui lòng liên hệ với chúng tôi theo địa chỉ email được cung cấp bên dưới.</p>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-3">6. Thay đổi Chính sách quyền riêng tư này</h2>
        <p className="mb-2">Chúng tôi có thể cập nhật Chính sách quyền riêng tư này theo thời gian. Chúng tôi sẽ thông báo cho bạn về bất kỳ thay đổi quan trọng nào bằng cách đăng Chính sách quyền riêng tư mới trên trang này.</p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-3">7. Liên hệ chúng tôi</h2>
        <p>Nếu bạn có bất kỳ câu hỏi nào về Chính sách quyền riêng tư này, vui lòng liên hệ với chúng tôi tại:</p>
        <p>Email: <a href={`mailto:${contactEmail}`} className="text-blue-600 hover:underline">{contactEmail}</a></p>
        <p>Website: <a href={websiteUrl} className="text-blue-600 hover:underline">{websiteUrl}</a></p>
      </section>
    </div>
  );
}