# Quizzard — Đặc tả Luồng Người Dùng (User Flow Spec)
**Sprint 1 — Giai đoạn thiết kế | Không viết code**

> Tài liệu này mô tả chi tiết luồng thao tác của Giáo viên (GV) và Sinh viên (SV) trong Quizzard, dùng làm nền cho: (1) wireframe, (2) mô hình dữ liệu, và (3) spec cho AI coding agent (OpenCode) ở các sprint sau.
> Các mục đánh dấu **[GIẢ ĐỊNH]** là mặc định mình chọn để viết tiếp — sửa lại nếu không đúng ý.
> Các mục đánh dấu **[CẦN CHỐT]** là quyết định quan trọng cần bạn xác nhận trước khi qua bước wireframe.

---

## 1. Thuật ngữ dùng trong tài liệu

| Thuật ngữ | Ý nghĩa |
| --- | --- |
| **Lớp (Class)** | Một lớp học do 1 GV tạo, có Class ID + mật khẩu riêng để SV tham gia |
| **Bài giảng (Lecture)** | Một đơn vị nội dung trong giáo trình (ví dụ: "Buổi 3 – Chuẩn hoá CSDL"); mỗi bài giảng có đúng 1 quiz đi kèm |
| **Quiz** | Bài kiểm tra gắn với 1 bài giảng, có hạn chót + thời gian làm bài riêng |
| **Question Bank** | Tập câu hỏi **cố định** do AI sinh cho 1 quiz; GV có thể bấm sinh thêm câu vào bank nếu muốn nhiều câu hơn. Câu hỏi dạng **tính toán** có số liệu random riêng cho từng SV, đáp án đúng tính theo công thức; các câu còn lại (khái niệm, trắc nghiệm...) giữ nguyên nội dung, không đổi theo SV |
| **Đề của SV** | Một tập con câu hỏi rút ngẫu nhiên từ Question Bank (đủ số lượng đã cấu hình ở 4.4), thứ tự câu + thứ tự đáp án được xáo trộn riêng cho từng SV; câu tính toán được random số riêng cho từng SV |
| **Hạn chót (Deadline)** | Thời điểm cuối cùng SV được phép **bắt đầu** làm quiz |
| **Thời gian làm bài (Time limit)** | Số phút SV có, tính từ lúc **bắt đầu** làm bài — độc lập với hạn chót |
| **Lượt làm bài (Attempt)** | 1 lần SV làm 1 quiz. **[GIẢ ĐỊNH]** MVP chỉ cho 1 lượt/SV/quiz |

## 2. Vai trò người dùng
- **Giáo viên (GV):** tạo lớp, upload tài liệu, cấu hình & duyệt quiz, xem thống kê.
- **Sinh viên (SV):** tham gia lớp, làm quiz, xem điểm & bảng xếp hạng.
- **[GIẢ ĐỊNH]** Không có vai trò Admin/nhà trường trong MVP. Mỗi tài khoản chỉ có 1 vai trò cố định, chọn lúc đăng ký.

## 3. Luồng xác thực (dùng chung GV & SV)
1. **Đăng ký:** họ tên, email/username, mật khẩu, chọn vai trò (GV / SV).
2. **Đăng nhập:** email/username + mật khẩu → tạo session cookie (iron-session, theo stack đã chọn).
3. Sau đăng nhập, chuyển hướng theo vai trò:
   - GV → Dashboard "Lớp của tôi"
   - SV → Dashboard "Lớp đã tham gia"
- **[GIẢ ĐỊNH]** MVP **không** làm: xác thực email, quên mật khẩu, đăng nhập Google/OAuth. Ghi rõ trong thuyết minh là "hướng phát triển tiếp theo".

## 4. Luồng Giáo viên

### 4.1 Tạo lớp học
- GV bấm "Tạo lớp mới" → nhập Tên lớp (+ mô tả, không bắt buộc).
- Hệ thống tự sinh **Class ID** duy nhất; GV đặt (hoặc để hệ thống tự sinh) **mật khẩu lớp**.
- Lớp mới xuất hiện trong Dashboard; GV xem/đổi Class ID + mật khẩu bất kỳ lúc nào.

### 4.2 Upload tài liệu học tập
- GV vào 1 lớp → "Upload tài liệu" → chọn file PDF (giáo trình, slide...).
- **[GIẢ ĐỊNH]** Chỉ hỗ trợ PDF cho MVP; cho phép **nhiều file** cho 1 lớp (giáo trình thường tách theo buổi).
- Hệ thống hiện trạng thái xử lý: "Đang đọc tài liệu..." → "Đã xử lý xong".

### 4.3 AI đề xuất cấu trúc Bài giảng *(bổ sung — xem mục 6.1)*
- Sau khi đọc xong tài liệu, AI tự phân tích và đề xuất danh sách **Bài giảng**, mỗi bài giảng gắn với phần tài liệu tương ứng (trang/chương) để sau này sinh câu hỏi có nguồn rõ ràng.
- GV xem danh sách, có thể: sửa tên, gộp/tách bài giảng, xoá bài không cần quiz, hoặc thêm bài giảng thủ công (khi tài liệu không đủ chi tiết).
- GV bấm "Xác nhận cấu trúc" → hệ thống tạo 1 quiz trạng thái **draft** cho mỗi bài giảng.

### 4.4 Cấu hình quiz cho từng bài giảng
Với mỗi bài giảng, GV vào màn hình cấu hình quiz và nhập:
- **Hướng dẫn cho AI** (nội dung trọng tâm, loại câu hỏi: trắc nghiệm / tự luận ngắn / tự luận dài, độ khó)
- **Số lượng câu hỏi**
- **Thời gian làm bài** (phút)
- **Hạn chót** — đặt ngay hoặc để tới bước xuất bản (4.7)

### 4.5 Sinh câu hỏi mẫu (preview) — vòng lặp chỉnh sửa *(bổ sung — xem mục 6.2)*
- GV bấm "Sinh câu hỏi mẫu" → AI trả 3–5 câu ví dụ theo hướng dẫn hiện tại.
- Chưa đúng ý → GV sửa hướng dẫn ở 4.4 → sinh lại (lặp lại tuỳ ý).
- Lý do tách bước này: sinh mẫu rẻ hơn sinh cả Question Bank, tiết kiệm quota Gemini free-tier — quan trọng vì ngân sách gần $0.

### 4.6 Sinh & duyệt Question Bank — **[ĐÃ CHỐT]**
- Khi GV hài lòng với mẫu, bấm "Sinh Question Bank đầy đủ" → AI sinh bộ câu hỏi **cố định** cho quiz này. **[ĐÃ CHỐT]** Mặc định sinh **5× số câu/đề** đã cấu hình ở 4.4 (ví dụ đề 10 câu → pool 50 câu), để mỗi SV rút được tập con khác nhau đáng kể (xem mục 5.4).
- Với câu hỏi dạng tính toán: AI sinh 1 **công thức/template số liệu** (ví dụ: biến a, b random trong khoảng X, đáp án = f(a, b)); phần còn lại của câu hỏi giữ cố định.
- Hệ thống tự chạy **blind re-check** (lượt gọi AI thứ 2, độc lập) rà soát từng câu → gắn trạng thái:
  - `draft` — mới sinh, chưa re-check
  - `flagged_for_review` — re-check phát hiện vấn đề (sai đáp án, mơ hồ, công thức tính sai...)
  - `approved` — qua re-check hoặc được GV duyệt tay
- GV mở màn hình **Question Bank**: xem toàn bộ câu hỏi, các câu `flagged_for_review` hiển thị ưu tiên lên đầu.
- GV có thể: sửa nội dung/đáp án, xoá câu, **thêm câu thủ công**, bấm **"Sinh thêm câu hỏi"** để AI bổ sung thêm câu vào bank, hoặc **upload bank riêng** (CSV/Excel, cột: `question, type, options, correct_answer, explanation`) để thay thế/bổ sung — vì bank giờ là pool cố định, câu upload lên dùng nguyên văn, không cần AI xử lý gì thêm.
- **"Sinh thêm câu hỏi"**: GV tự chọn **số lượng** câu muốn sinh thêm và viết **instruction riêng** cho phần bổ sung này (độ khó, nội dung/chủ đề cụ thể — có thể khác với hướng dẫn gốc ở 4.4, ví dụ "thêm 10 câu khó hơn về phần Chương 3"); AI sinh thêm và nối vào pool hiện có, không tạo trùng câu đã có, và cũng đi qua blind re-check như bình thường.
- **AI không tự paraphrase hoặc sửa lại nội dung câu hỏi đã có trong bank** — mọi câu hỏi (trừ số liệu random của câu tính toán) là cố định, giống nhau cho mọi SV khi được chọn vào đề.

### 4.7 Duyệt & xuất bản quiz
- Khi mọi câu trong bank ở trạng thái `approved` (hoặc GV chủ động bỏ qua flag), GV xác nhận hạn chót → bấm **"Xuất bản"**.
- Quiz chuyển `draft` → `published`; SV trong lớp bắt đầu thấy quiz.
- **[ĐÃ CHỐT]** Sau khi xuất bản (kể cả trước khi có SV nộp bài đầu tiên): khoá sửa/xoá nội dung Question Bank đã publish (đảm bảo công bằng điểm số). GV chỉ được **nới rộng** hạn chót (không rút ngắn); thời gian làm bài và nội dung câu hỏi giữ nguyên. Muốn sửa câu hỏi → chỉ áp dụng cho các lượt SV làm bài **sau đó** (không hồi tố cho SV đã làm).

### 4.8 Theo dõi sau khi xuất bản
- Bảng xếp hạng lớp theo quiz + theo tổng điểm cả lớp.
- Danh sách SV đã làm / chưa làm / quá hạn chưa làm.
- Danh sách báo lỗi câu hỏi do SV gửi (xem 5.5) → GV xử lý (sửa câu cho lượt sau / miễn điểm câu đó).

## 5. Luồng Sinh viên

### 5.1 Đăng ký / đăng nhập
Theo mục 3.

### 5.2 Tham gia lớp học
SV bấm "Tham gia lớp" → nhập Class ID + mật khẩu lớp → tham gia thành công, lớp xuất hiện trong "Lớp của tôi".

### 5.3 Xem danh sách quiz
Theo từng bài giảng: tên, hạn chót, thời gian làm bài, trạng thái (chưa làm / đã làm / quá hạn không làm).

### 5.4 Làm quiz
- SV bấm "Bắt đầu làm bài" — chỉ khả dụng nếu **trước hạn chót** và **chưa từng làm quiz này**.
- Hệ thống rút ngẫu nhiên đủ số câu đã cấu hình từ Question Bank đã duyệt, xáo trộn thứ tự câu + thứ tự đáp án (seeded shuffle theo SV, không cần gọi AI); riêng câu tính toán được random số liệu riêng cho SV này.
- Hiển thị đồng hồ đếm ngược theo thời gian làm bài; hết giờ tự nộp bài (đếm ngược JS + server kiểm tra lại timestamp khi nhận bài).
- **[GIẢ ĐỊNH]** Nếu SV bắt đầu ngay trước hạn chót, vẫn được dùng **đủ** thời gian làm bài đã cấu hình, dù kết thúc sau hạn chót.

### 5.5 Xem kết quả
- Điểm số, câu đúng/sai (+ đáp án đúng, giải thích nếu có).
- Nút "Báo lỗi câu hỏi" cho từng câu — gửi báo cáo cho GV (mục 4.8).

### 5.6 Bảng xếp hạng
Xem vị trí của mình so với cả lớp. **[ĐÃ CHỐT]** Hiển thị họ tên thật của SV, không ẩn danh.

## 6. Những phần mình bổ sung / làm rõ so với mô tả gốc của bạn

1. **AI tự đề xuất cấu trúc Bài giảng từ tài liệu** (4.3) — trước đây "bài giảng" do GV tự khai; giờ AI đọc tài liệu và đề xuất trước, GV chỉ chỉnh sửa. Cập nhật nhẹ phạm vi epic "Upload bài giảng" ở Slice 1.
2. **Tách bước "sinh mẫu" và "sinh Question Bank đầy đủ"** (4.5 vs 4.6) để tiết kiệm lượt gọi Gemini free-tier.
3. **Question Bank = pool cố định** (đã chốt): mỗi SV nhận 1 tập con random + xáo trộn thứ tự từ pool, riêng câu tính toán random số liệu theo công thức. Đây là cơ chế thực tế thay thế cho ý tưởng ban đầu "AI sinh đề riêng hoàn toàn" — tính khác biệt "chống sao chép" giờ nằm ở việc **rút tập con + xáo trộn + random số liệu**, không phải sinh nội dung khác nhau. **[ĐÃ CHỐT]** Pool mặc định = **5× số câu/đề** (ví dụ đề 10 câu → pool sinh sẵn 50 câu) để tập con của các SV không trùng nhau quá nhiều.
4. **Cơ chế upload/bổ sung Question Bank riêng** + định dạng file chuẩn.
5. **Khoá sửa/xoá nội dung sau khi xuất bản** — nguyên tắc công bằng (đã chốt: chỉ được nới hạn chót).
6. **Báo lỗi câu hỏi sau khi nộp bài** (5.5) — nối lại với cơ chế human-in-the-loop đã có trong kế hoạch gốc.
7. **Giới hạn 1 lượt làm bài/SV/quiz** — thêm vào để tránh SV làm lại "cày điểm".
8. **Phạm vi xác thực tối giản** (không OAuth/quên mật khẩu) để agent code không build dư việc không cần.

## 7. Các quyết định đã chốt

| # | Vấn đề | Quyết định |
| --- | --- | --- |
| 1 | Question Bank là template hay pool cố định? | **Pool cố định.** Câu tính toán random số liệu + đáp án tính theo công thức; các câu khác giữ nguyên nội dung cho mọi SV. GV có thể sinh thêm câu vào pool nếu muốn |
| 2 | AI có paraphrase câu hỏi trong bank không? | **Không.** AI không tự sửa/diễn giải lại câu hỏi đã có trong bank |
| 3 | SV hiện tên thật hay ẩn danh trên bảng xếp hạng? | **Hiện tên thật** |
| 4 | Sau khi xuất bản, GV được sửa gì? | **Chỉ được nới hạn chót**; không sửa/xoá câu hỏi đã publish, không rút ngắn hạn chót |
| 5 | Pool nên lớn hơn số câu/đề bao nhiêu? | **Mặc định 5×** số câu/đề; GV có thể sinh thêm câu bất kỳ lúc nào qua "Sinh thêm câu hỏi" (tự chọn số lượng, độ khó, nội dung riêng cho phần bổ sung) |

## 8. Màn hình cần thiết kế wireframe tiếp theo

| Màn hình | Vai trò | Ghi chú |
| --- | --- | --- |
| Đăng ký / Đăng nhập | GV, SV | Chung 1 form, chọn vai trò lúc đăng ký |
| Dashboard lớp của tôi | GV | Danh sách lớp + nút tạo lớp |
| Chi tiết lớp – Upload tài liệu | GV | Trạng thái xử lý tài liệu |
| Xác nhận cấu trúc Bài giảng | GV | Sửa/gộp/tách bài giảng AI đề xuất |
| Cấu hình quiz | GV | Hướng dẫn, số câu, thời gian, hạn chót |
| Preview câu hỏi mẫu | GV | Vòng lặp sinh lại |
| Question Bank | GV | Danh sách câu hỏi, trạng thái duyệt, sửa/upload |
| Xuất bản & theo dõi quiz | GV | Bảng xếp hạng, danh sách nộp bài, báo lỗi |
| Tham gia lớp | SV | Nhập Class ID + mật khẩu |
| Danh sách quiz | SV | Theo bài giảng |
| Làm quiz | SV | Đồng hồ đếm ngược |
| Kết quả + báo lỗi | SV | |
| Bảng xếp hạng | SV | |

## 9. Bước tiếp theo trong Sprint 1
- Chốt mục 7 → vẽ wireframe cho các màn hình ở mục 8.
- Sau wireframe → hoàn thiện mô hình dữ liệu (entity gợi ý: `User, Class, Material, Lecture, Quiz, QuestionBankItem, StudentAttempt, StudentAnswer, QuestionReport`).
