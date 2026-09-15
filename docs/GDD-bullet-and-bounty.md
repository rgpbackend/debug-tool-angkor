# **Game Design Document (GDD) \- Bullet and Bounty**

**Tên Game:Bullet and Bounty**  
**Phiên bản GDD:** 1.0  
**Ngày:** 2026-8-18

---

# [**1\. Tổng quan Game**](https://nolimitcity.com/demo/Deadwood?showNavbar=true)

## **1.1. Giới thiệu**

- **Theme:** Wild West u tối, bạo lực, rỉ sét và đầy khói bụi.

## **1.2. Mục tiêu Thiết kế**

- **Đảm bảo mô hình toán học cân bằng và hấp dẫn:** Duy trì chỉ số RTP (Return to Player) mục tiêu ở mức cạnh tranh **\~96%**

## **1.3. Nền tảng Mục tiêu**

- Mobile App: (iOS & Android)
- Web: (Browser-based for desktop & mobile)

---

###

# **2\. Cơ chế Gameplay Cốt lõi (Core Mechanics)**

## **2.1. Lưới (Grid) & Từ 576 Ways**

- **Lưới:**
  - **Main Reels**: 5 cuộn dọc.
    - **Cuộn 1 và 5:** Chứa **3** biểu tượng
    - **Cuộn 2, 3 và 4**: Chứa 4 biểu tượng
- Cơ chế **576 Ways to win** là một hệ thống trả thưởng không sử dụng các đường thắng (win wayss) truyền thống. Thay vào đó, nó bao gồm tất cả các khả năng thắng có thể xảy ra trên lưới
- **Xác định số Way**
  - Trong lưới,, số Ways được tính bằng cách nhân số lượng vị trí (rows) trên mỗi cuộn:
    - **Số ways \= R1 x R2 x R3 x R4 x R5 \= 3 x 4 x 4 x 4 x 3 \= 576**

## **2.2. Điều khiển Người chơi (Controls)**

- **Hiển thị Balance của users.**
- **Hiển thị mức BET hiện tại.** Khi users tab vào ô đó sẽ hiện option:
  - 0.20$
  - 0.40$
  - 0.60$
  - 0.80$
  - 1.00$
  - 1.20$
  - 1.60$
  - 2.00$
  - 2.40$
  - 2.80$
  - 3.20$
  - 3.60$
  - 4.00$
  - 5.00$
  - 6.00$
  - 8.00$
  - 10.00$
  - 14.00$
  - 18.00$
  - 24.00$
  - 32.00$
  - 40.00$
  - 60.00$
  - 80.00$
  - 100.00$
- **Hiển thị số tiền win.**
- **Nút Bật/ Tắt Fast Spin**
  - Khi kích hoạt chế độ này mỗi lượt Spin sẽ trả về kết quả ngay lập tức
  - Tắt hiệu ứng tease mỗi khi quay 2 Scatter
  - Khi **tính năng bị tắt (OFF)**:
    - Khi **mở game**: Nút này **luôn ở trạng thái tắt (OFF) theo mặc định**.
  - Khi users hover lên nút, xuất hiện một vòng quanh nút.
- **Spin**: Users bấm vào để bắt đầu vòng quay
  - Hiệu ứng của nút:
    - Khi nút ở trạng thái chờ (Idle), hiển thị **animation hai mũi tên quay vòng, nối đuôi nhau**. Animation chạy với tốc độ tiêu chuẩn, lặp vô hạn cho đến khi có tương tác.
    - Khi users hover trên nút thì nút sẽ xuất hiện 1 vòng sáng bao quanh nút
    - Trong quá trình Cascade: Nút chuyển sang trạng thái mất màu (desaturated/greyed-out).Nút thể hiện rõ là tạm thời không khả dụng.
    - Khi kích hoạt chế độ auto spin thì nút từ tròn sẽ chuyển sang dạng vuông và ở trung tâm nút hiển thị số lượt Spin còn lại.
      - Khi bấm vào nút một lần nữa thì Auto Spin **kết thúc ngay lập tức**.Nút quay về **trạng thái Spin thường (Idle)** và dừng tại vòng quay hiện tại.
- **Autospin**: Users bấm vào sẽ hiện các mốc
  - **10 lần**
  - **25 lần**
  - **50 lần**
  - **100 lần**
  - **250 lần**
  - **1000 lần**
  - **Vô cực**
    - Khi users hover lên nút, xuất hiện một vòng quanh nút.
- **Menu:** bấm vào sẽ hiện:
  - **Sound:** Nút Bật/ Tắt Âm thanh
  - **Paytable:** bấm vào sẽ vào bảng paytable
  - **History:** Hiển thị lịch sử chơi
  - **Close**: tắt menu
    - Khi users hover lên các nút, xuất hiện một vòng quanh nút.

## **2.3. Quy tắc Thắng Cược & Công Thức Payout**

- **Một tổ hợp thắng hợp lệ (Valid Win Combination) phải thỏa mãn các điều kiện sau:**
  - **Cách Thắng**: **Cuộn Bắt đầu:** Tổ hợp phải bắt đầu từ **Cuộn 1** (Reel 1).
  - **Cuộn Liền kề:** Biểu tượng thắng phải xuất hiện trên các cuộn **liền kề** (Consecutive Reels) theo chuỗi và vị trí trên hàng là không quan trọng (ví dụ: R1-R2-R3).
  - **Biểu tượng:** Phải là các biểu tượng giống nhau

- Đối với một chuỗi biểu tượng liên tục, **chỉ kết hợp thắng dài nhất** (có giá trị cao nhất) được thanh toán.
- Khi các tổ hợp thắng được A ra, những biểu tượng thắng sẽ bị loại bỏ, kích hoạt tính **năng Cascade.**
- **Tính năng Tumble (Cascade):**
  - Những biểu tượng thắng hợp lệ sẽ được tính tiền thắng và bị loại bỏ, các biểu tượng từ phía trên của các cuộn sẽ rơi xuống để lấp đầy các khoảng trống.
  - Quá trình Tumble sẽ tiếp tục lặp lại cho đến khi không còn tổ hợp thắng nào nữa.
  - Tất cả tiền thắng tích lũy từ toàn bộ các lần sụp đổ (từ cùng một vòng quay cơ bản ban đầu) sẽ được cộng gộp và chuyển vào số dư (balance) của người chơi duy nhất một lần sau khi chuỗi Tumble kết thúc hoàn toàn.
- **Công thức Tính toán Lặp lại (Số Lần Thắng):**
  - Được tính bằng tích số của số lần biểu tượng thắng xuất hiện trên mỗi cuộn liên quan:
    - **Số lần thắng lập \= N1 x N2 x N3 x …….**
  - Ví dụ:
    - Ta có tổ hợp thắng 6 biểu tượng **A trên 3 cột** như bảng Ta thấy:

| Cuộn (Reel)            | R1       | R2       | R3       | R4      | R5      |
| :--------------------- | :------- | :------- | :------- | :------ | :------ |
| **Biểu tượng A**       | **2**    | **3**    | **1**    | **N/a** | **N/a** |
| **(Số lần xuất hiện)** | **(N1)** | **(N2)** | **(N3)** |         |         |

      * **Trên Cuộn 1 (N1):** A xuất hiện **2 lần**.
      * **Trên Cuộn 2 (N2):** A xuất hiện **3 lần**.
    * **Trên Cuộn 3 (N3):** A xuất hiện **1 lần**.
    * Ta áp dụng công thức vào ví dụ:
      * Số lần thắng lập \= 2 x 3 x1 \= 6

- **Công thức tính Payout cuối cùng**:
  - **Final Win \= (Số lần thắng lập) x (Hệ số payout Cx) x ( Bet) x Wild Multiplier**
  - **Trong đó Hệ Số Payout (Cx):** Là Hằng số cố định cho mỗi tổ hợp (xem bảng 3.2), không đổi khi Total Bet thay đổi. ( Ví dụ Cx của A là 0.25)
  - **Total Bet:** Tổng số tiền bạn đã đặt cược trong vòng quay đó**. (Ví dụ: $1.00).**
  - **Multiplier:** xem chi tiết phần 4 **(Ví dụ: Multiplier \= 1).**
  - Khi kết hợp với công thức trên ta có:
    - Final Win \= 6 x 0.25 x 1 x 1 \= 1.5$
  - Ngoài ra theo rule của game gốc, Tiền thưởng sẽ được giới hạn bởi Win Cap 13950x nên ta có công thức:
    - **Final Payout \= min(Payout cơ bản,13950 x Bet)**
    - Ví dụ
      - Win cap \= **13950** x Bet \= 13950 x 1 \= 13950
      - Ta thế số vào công thức:
        - Final Payout \= min(1.5$ ,13950) \= 1.5$

---

# 3\. Biểu tượng & Bảng Thanh toán (Symbols & Paytable)

**3.1. Chủ đề Biểu tượng**  
Để hấp dẫn hơn, các biểu tượng (A, B, C, D, E, F, G, H,I, K, W, S) sẽ được thiết kế lại như sau:

| Mã Logic | Tên Biểu tượng (Theme)                                                  |   Loại   | Ghi chú |
| :------: | ----------------------------------------------------------------------- | :------: | ------- |
|    A     | **“Black Jack" Vance**                                                  | High Win |         |
|    B     | **“Dynamite" Daisy**                                                    | High Win |         |
|    C     | **"Deadeye" Dalton**                                                    | Mid Win  |         |
|    D     | **The Busted Safe**                                                     | Mid Win  |         |
|    E     | Khẩu Shotgun cưa nòng                                                   | Mid Win  |         |
|    F     | Chai Whiskey vỡ                                                         | Mid Win  |         |
|    G     | Thẻ bài Ace (A) cắm dao                                                 | Low Win  |         |
|    H     | Thẻ King (K) dính lỗ đạn                                                | Low Win  |         |
|    I     | Thẻ Queen (Q) vấy máu                                                   | Low Win  |         |
|    K     | Thẻ Jack (J) rỉ sét.                                                    | Low Win  |         |
|    W     | Là hình ảnh của 3 Thợ săn tiền thưởng (Bounty Hunters) phe chính nghĩa. |   Wild   |         |
|    S     | **Đầu lâu trâu đẫm máu (Bloody Bull Skull)**                            | Scatter  |         |

- **Biểu tượng đặc biệt P:**
  - Biểu tượng đặc biệt chỉ xuất hiện ở cuộn 1 và cuộn 5

|  P  | Sheriff Badge |     |     |
| :-: | :------------ | :-: | :-- |

## **3.2. Bảng Thanh toán (Paytable)** Hệ số Payout của từng biểu tượng

| Biểu tượng |   3   |   4   |   5   | Phân Loại |
| :--------: | :---: | :---: | :---: | :-------: |
|     A      | 0.25x | 0.75x | 3.75x | High Win  |
|     B      | 0.2x  | 0.6x  | 3.0x  | High Win  |
|     C      | 0.2x  | 0.6x  | 2.5x  |  Mid Win  |
|     D      | 0.15x | 0.5x  | 2.0x  |  Mid Win  |
|     E      | 0.15x | 0.5x  | 1.5x  |  Low Win  |
|     F      | 0.1x  | 0.35x | 1.25x |  Low Win  |
|     G      | 0.1x  | 0.35x | 1.25x |  Low Win  |
|     H      | 0.05x | 0.25x | 1.0x  |  Low Win  |
|     I      | 0.05x | 0.25x | 1.0x  |  Low Win  |
|     K      | 0.05x | 0.25x | 1.0x  |  Low Win  |
|     W      |  N/a  |  N/a  |  N/a  |   Wild    |
|     S      |  N/a  |  N/a  |  N/a  |  Scatter  |

---

# [**4\. Tính năng Đặc biệt: Hunter Wild**](https://drive.google.com/file/d/1eCgF79iUL0b2vjThRngTjJxvfbC8mImm/view?usp=drive_link)

## **4.1. Tên tính năng:**

- Biểu tượng Hunter Wild

## **4.2. Cách kích hoạt (Trigger)**

- Hunter Wild sẽ xuất hiện ngẫu nhiên trên Grid khi Spin

## **4.3. Logic Gameplay**

- Biểu tượng Wild có kích thước cao 4 ô, chỉ xuất hiện trên các cuộn 2, 3 và 4\.
- Biểu tượng Wild này có khả năng thay thế cho bất kỳ biểu tượng nào khác để tạo ra win ways, ngoại trừ biểu tượng Scatter và Bonus.
- Biểu tượng này luôn tự động trượt để mở rộng kín cả một cuộn.
  - Ví dụ: Khi Wild rơi trúng ô thứ 3 trên cuộn 2, nó sẽ trượt 2 bước để lấp đầy và biến toàn bộ cuộn 2 thành biểu tượng Wild.
- **Wild Multiplier:**
  - Khi biểu tượng Hunter Wild dịch chuyển để bao phủ toàn bộ cuộn, mỗi bước đi sẽ cộng thêm 1 vào hệ số nhân chiến thắng; đặc biệt, trường hợp có nhiều Wild cùng xuất hiện, tất cả các hệ số nhân sẽ được cộng dồn lại để tối ưu tổng mức thưởng.

---

# [**5\. Tính năng Đặc biệt: Shoot Out**](https://drive.google.com/file/d/143oKad_DJREFmOZRhAZWdRfl8m2eLQXf/view?usp=drive_link)

## **5.1. Tên tính năng:**

- Shoot Out

## **5.2. Cách kích hoạt (Trigger)**

- **Kích hoạt:** Tính năng này được kích hoạt khi người chơi quay trúng các biểu tượng P trên cả cuộn 1 và cuộn 5 trong trò chơi chính.

## **5.3. Logic Gameplay**

- Khi được kích hoạt, tất cả các biểu tượng trả thưởng thấp (low win symbols) nằm trên 3 cuộn ở giữa (2,3,4) sẽ tự động chuyển thành biểu tượng Wild.

---

# **6\. Tính năng đặc biệt: Free Spins**

## **6.1. Tên tính năng:**

- Free Spins

## **6.2. Cách kích hoạt (Trigger)**

- **Kích hoạt:**
  - Người chơi kích hoạt vòng quay miễn phí bằng cách quay trúng 3 biểu tượng Scatter. Sau khi kích hoạt, người chơi được quyền lựa chọn một trong hai chế độ: 8 vòng Gunslinger Spins hoặc 8 vòng Hunter Spins.

## **6.3. Phần thưởng (Reward)**

- Người chơi sẽ kích hoạt chế độ Gunslinger Spins hoặc Hunter Spins

## **6.4. Logic Gameplay**

- **Quy tắc Cược:** Gunslinger Spins hoặc Hunter Spins được chơi với mức cược của vòng chơi đã kích hoạt tính năng.
- [**Chế độ Gunslinger Spins**](https://drive.google.com/file/d/1_2FB4keQFh7rW3bjRJck0mqPS3lqS6AC/view?usp=sharing)
  - Trong chế độ này, biểu tượng Hunter Wilds sẽ mang lại một hệ số nhân chiến thắng không giới hạn và được giữ nguyên (sticks) trong suốt toàn bộ vòng chơi.
  - Tương tự như trò chơi chính, mỗi bước dịch chuyển của Hunter Wild sẽ làm tăng hệ số nhân chiến thắng lên 1\. Việc quay trúng thêm một biểu tượng Wild cũng sẽ làm tăng hệ số nhân này lên 1\.
  - Biểu tượng Sheriff Badge có thể rơi vào cuộn 1 và cuộn 5; mỗi biểu tượng rơi xuống sẽ thưởng cho người chơi thêm \+1 vòng quay.  
    Nếu quay trúng cả hai biểu tượng Sheriff Badge trong cùng một vòng quay, tính năng sẽ được nâng cấp thành **ShootOut Gunslinger Spins,** lúc này các biểu tượng Sheriff Badge sẽ bị khóa cố định tại chỗ.
- [**Chế độ Hunter Spins**](https://drive.google.com/file/d/1cBoIM3y2FyQrgGyMmONgHrCHGvAEGqiO/view?usp=drive_link)
  - Trò chơi đảm bảo sẽ có ít nhất 1 biểu tượng Hunter Wild rơi xuống trong mỗi vòng quay của chế độ này.
  - Các biểu tượng Sheriff Badge có thể xuất hiện trên cuộn 1 và cuộn 5; mỗi biểu tượng xuất hiện sẽ thưởng thêm \+1 vòng quay.
  - Nếu người chơi quay trúng cả hai biểu tượng Sheriff Badge trong cùng một vòng quay, tính năng sẽ được nâng cấp thành **Shootout Hunter Spins**, với các biểu tượng Sheriff Badge bị khóa cố định tại chỗ.
- **Case: Maximum Win Cap trong Free Spins**
  - Nếu users đạt Maximum Win Cap trong khi đang chơi Free Spins:
    - Hệ thống phải lập tức kết thúc session Free Spins
    - Không tiếp tục thực hiện các lượt Free Spin còn lại
    - Hiển thị popup thông báo:
    - ““Maximum Win Cap reached. You have received the maximum reward of \<X\>.”
      - \<X\> là số Bet x Wincap
      - Popup có thể:
        - Được users chủ động bấm đóng, hoặc
        - Tự động đóng sau một khoảng thời gian xác định
    - Sau khi popup đóng:
      - Kết thúc hoàn toàn phiên Free Spins tại thời điểm đó.
    - Popup này sẽ luôn được hiển thị kể cả khi:
      - Maximum Win Cap được đạt ở lượt Free Spin cuối cùng

## **6.5. Logic UI và VFX**

- **Hiệu ứng “Tease trường hợp quay gần ra”:**
  - Hiệu ứng Tease được thiết kế để tạo sự kịch tính tối đa cho người chơi khi họ sắp kích hoạt tính năng **Free Game**.
  - **Điều kiện Kích hoạt Tease:** Hiệu ứng này được kích hoạt ngay khi **3** biểu tượng Scatter đã xuất hiện và dừng lại trên cuộn.
  - **Mục tiêu:** Hiệu ứng được áp dụng cho (các) cuộn còn lại có khả năng chứa Số biểu tượng bonus còn lại.
  - **Thay đổi Trực quan (VFX):**
    - **Làm Tối Màn hình (Dimming):** Màn hình tối sầm lại,
    - **Highlight Cuộn:** Cuộn đang quay (cuộn Tease) sẽ được tự động **Highlight** Chỉ có một vệt nắng duy nhất (Spotlight) chiếu thẳng vào cuộn đang quay chậm..
  - **Thay đổi Tốc độ (Pacing):**
    - Tốc độ quay của cuộn Tease sẽ **chậm lại dần dần** so với tốc độ quay bình thường. Sự giảm tốc độ này phải diễn ra từ từ, tạo ra sự hồi hộp kéo dài.
  - **Luồng Lặp lại:** Nếu có nhiều hơn một cuộn có khả năng mang Scatter cuối cùng (tuy hiếm, nhưng có thể xảy ra trong một số cấu hình), hiệu ứng Tease (Làm tối, Highlight, Giảm tốc độ) sẽ được áp dụng **tuần tự** trên từng cuộn đó trước khi trả ra kết quả cuối cùng.
- **Free Spins Trigger:** Pop-up thông báo chiến thắng Free Spins với nút "START" để bắt đầu.
  - Giao diện game sẽ thay đổi thành giao diện Free Spin.
  - Một bộ đếm nổi bật hiển thị số vòng quay còn lại (ví dụ: "Spins Left: 10").
- **Free Spins Summary:** Khi kết thúc, một popup hiện ra tổng kết: "Congratulations\! You won a total of \[Số tiền thắng\]\!". Có một nút "CONTINUE" để quay lại game chính.
- Trong trường hợp đang quay **Free Spin** mà bị disconnect: Thì users vào lại game sẽ hiện popup thông báo users còn bao nhiêu lượt quay đang dang dở và ép users chơi xong hết các lượt free spins.

---

# **7\. Tính năng Đặc biệt: Shootout Free Spins**

## **7.1. Tên tính năng**

- Shootout Free Spins

## **7.2. Cách kích hoạt (Trigger)**

- Tính năng này có thể được kích hoạt trực tiếp từ trò chơi chính bằng cách quay trúng 2 biểu tượng Sheriff Badge cùng với 3 biểu tượng Scatter.
- Nó cũng có thể được kích hoạt bằng cách quay trúng 2 biểu tượng Sheriff Badge trong một vòng quay thuộc bất kỳ chế độ Free Spins thông thường nào (Gunslinger hoặc Hunter).

## **7.3 Reward**

- Nếu kích hoạt trực tiếp từ trò chơi chính, người chơi sẽ được thưởng 10 vòng quay trong chế độ mà họ tự chọn: [Shoot Out Gunslinger Spins](https://drive.google.com/file/d/1IZjYg6A0zPzq0SiptPhucyluORqAEz2t/view?usp=drive_link) hoặc [Shootout Hunter Spins.](https://drive.google.com/file/d/1crdS0hr02KLxwhESfbnVVg_calavREmF/view?usp=drive_link)
- Nếu kích hoạt khi đang ở sẵn vòng quay Gunslinger hoặc Hunter, hệ thống sẽ trực tiếp nâng cấp lên chế độ Shootout tương ứng."

## **7.4. Logic Gameplay**

- **Quy tắc Cược:** Shoot Out Gunslinger Spins hoặc Shoot Out Hunter Spins được chơi với mức cược của vòng chơi đã kích hoạt tính năng.
- Trong suốt thời gian diễn ra tính năng này, các biểu tượng Sheriff Badge sẽ bị khóa cố định ở vị trí của chúng, từ đó liên tục kích hoạt tính năng Shoot Out trên mỗi vòng quay (điều này có nghĩa là tất cả các biểu tượng trả thưởng thấp trên các cuộn giữa sẽ biến thành Wilds liên tục).
- **Case: Maximum Win Cap trong Free Spins**
  - Nếu users đạt Maximum Win Cap trong khi đang chơi Free Spins:
    - Hệ thống phải lập tức kết thúc session Free Spins
    - Không tiếp tục thực hiện các lượt Free Spin còn lại
    - Hiển thị popup thông báo:
    - ““Maximum Win Cap reached. You have received the maximum reward of \<X\>.”
      - \<X\> là số Bet x Wincap
      - Popup có thể:
        - Được users chủ động bấm đóng, hoặc
        - Tự động đóng sau một khoảng thời gian xác định
    - Sau khi popup đóng:
      - Kết thúc hoàn toàn phiên Free Spins tại thời điểm đó.
    - Popup này sẽ luôn được hiển thị kể cả khi:
      - Maximum Win Cap được đạt ở lượt Free Spin cuối cùng

## ---

# **8\. Tính năng Đặc biệt: Buy Feature**

## **8.1. Tên tính năng**

- Buy Feature

## **8.2. Cách kích hoạt (Trigger)**

- Tính năng chỉ có thể được kích hoạt khi người chơi đang ở trạng thái chờ (Idle) trong Base Game. Không khả dụng khi các cuộn đang quay hoặc đang trong vòng quay miễn phí.
- Người chơi có thể chọn mua tính năng Free Games từ giao diện trò chơi (UI)
- Người chơi có 2 option để mua
  - Free Spins
  - Shootout Free Spins

## **8.3 Reward**

- Khi mua FREE SPINS:
  - Ngay sau khi thanh toán, trò chơi sẽ kích hoạt Gunslinger Spins hoặc Hunter Spins theo lựa chọn của users
- Khi mua SHOOTOUT FREE SPINS:
  - Ngay sau khi thanh toán, trò chơi sẽ kích hoạt Shootout Gunslinger Spins hoặc Shootout Hunter Spins theo lựa chọn của users

## **8.4. Logic Gameplay**

- **FREE SPINS:**
  - **Quy tắc Tính toán Chi phí:**
    - **Buy Cost \= 71 x Bet**
  - **Thanh toán:** Khi mua, số tiền tương đương chi phí sẽ bị trừ vào số dư của người chơi.
  - Logic game play sẽ như Gunslinger Spins / Hunter Spins
- **SHOOTOUT FREE SPINS:**
  - **Quy tắc Tính toán Chi phí:**
    - **Buy Cost \= 750 x Bet**
  - **Thanh toán:** Khi mua, số tiền tương đương chi phí sẽ bị trừ vào số dư của người chơi.
  - Logic game play sẽ như Shootout Gunslinger Spins / Shootout Hunter Spins
- **Quy tắc tạo kết quả khi mua tính năng:**
  - Tuy nhiên kết quả lưới chỉ được phép tạo ra điều kiện kích hoạt Free Spin theo quy định của tính năng.
  - Trong quá trình tạo kết quả, hệ thống phải đảm bảo không hình thành bất kỳ tổ hợp thắng nào khác ngoài điều kiện kích hoạt Free Spin,

## ---

# **9\. Tính năng Đặc biệt: WANTED BOUNTY COLLECTION**

## **9.1. Tên tính năng**

- Wanted Bounty Collection (Hệ thống Thu thập Lệnh truy nã)

## **9.2. Cách kích hoạt (Trigger)**

- Biểu tượng Wanted Poster xuất hiện dưới dạng một lớp phủ (overlay) nhỏ, gắn đè lên góc dưới bên phải của bất kỳ biểu tượng Low Win nào (A, K, Q, J, 10).
- **Điều kiện thu thập:** Nếu biểu tượng có chứa Wanted Poster tham gia vào một tổ hợp thắng hợp lệ (Winning Combination), hệ thống sẽ cộng \+1 Lệnh truy nã vào thanh thu thập.
- Khi thu thập đủ **100/100**, người chơi sẽ nhận được 1 vé kích hoạt trực tiếp vòng quay Shoot Out Free Spins (Tương đương giá trị mua 750x Bet).

## **9.3 Reward**

- Người chơi được quyền chọn giữa: Shoot Out Gunslinger Spins hoặc Shoot Out Hunter Spins.

## **9.4. Logic Gameplay**

- Hệ thống có tỷ lệ rơi ngẫu nhiên là **0.8% mỗi vòng quay** cho việc xuất hiện biểu tượng Lệnh truy nã (Wanted Poster).
- Nếu biểu tượng có Wanted Poster xuất hiện trên lưới nhưng KHÔNG tạo thành đường thắng, lệnh truy nã đó bị vô hiệu hóa và biến mất khi vòng quay kết thúc.
- **Reset:** Sau khi kết thúc vòng Shoot Out Free Spins từ phần thưởng này, thanh Bounty Bar tự động reset về 0 / 100 để bắt đầu chu kỳ mới.
- **Ràng buộc Chế độ chơi:** Biểu tượng Wanted Poster **CHỈ XUẤT HIỆN TRONG BASE GAME**. Tuyệt đối không xuất hiện trong bất kỳ vòng quay Free Spins nào để bảo vệ cấu trúc quỹ trả thưởng (RTP).
- **Logic Lưu trữ (Save State theo Bet):**
  - Thanh Bounty Bar được lưu trữ độc lập cho từng mức Cược (Total Bet).
  - Ví dụ: Nếu người chơi đang ở mức cược 1$ (tiến trình 50/100) và chuyển sang mức cược 2$, thanh Bounty Bar ở mức 2$ sẽ hiển thị tiến trình riêng của nó (ví dụ 0/100). Khi quay lại mức 1$ sẽ khôi phục lại đúng tiến trình 50/100.
- **Xử lý ngoại lệ**
  - **Trường hợp xung đột tính năng Shoot Out (Biến đổi Wild):** Khi tính năng Shoot Out được kích hoạt, nếu các biểu tượng Low Win ở cột 2, 3 và 4 đang có gắn lớp phủ Wanted Poster bị biến đổi thành biểu tượng Wild, lớp phủ Wanted Poster này VẪN SẼ ĐƯỢC GIỮ LẠI. Sau khi hệ thống tính toán trả thưởng xong cho tổ hợp thắng với biểu tượng Wild mới, Wanted Poster này vẫn được coi là hợp lệ và sẽ được thu thập vào thanh Bounty Bar.
  - Nếu 1 vòng quay vừa ra 3 Scatter (Kích hoạt Free Spin) VỪA rớt lệnh truy nã thứ 100, hệ thống sẽ đưa vào Hàng đợi (Queue) và ưu tiên xử lý kết quả trực tiếp trên lưới trước theo trình tự sau:
    - **Bước 1**: Cập nhật Bounty Bar lên 100/100 và đặt ở trạng thái CHỜ (Pending).
    - **Bước 2:** Kích hoạt tính năng Free Spins (Gunslinger/Hunter) từ 3 biểu tượng Scatter.
    - **Bước 3:** Sau khi chơi xong chuỗi Free Spins và nhận thưởng xong, thay vì quay lại Base Game, màn hình lập tức chuyển cảnh để kích hoạt phần thưởng Shoot Out Free Spins từ thanh Bounty Bar.
  - Nếu trong lúc thực thi Bước 2 (Chơi Free Spins từ Scatter), người chơi quá may mắn chạm Max Win Cap (13,950x Bet), phiên chơi (Bet ID) đó lập tức bị ngắt.
    - **Giải pháp Bảo vệ UX (Bảo lưu trạng thái):** Hệ thống **SẼ KHÔNG HỦY BỎ** tiến trình 100/100 của thanh Bounty Bar. Tiến trình này được đặt vào trạng thái **Pending (Chờ kích hoạt)** ở mức Bet tương ứng.
    - **Cách thức Kích hoạt bù:** Khi người chơi quay trở lại Base Game ở đúng mức Bet đó, hệ thống sẽ **KHÔNG yêu cầu người chơi phải thực hiện thêm một vòng quay trả phí nào nữa**. Thay vào đó, một Popup thông báo _"Bounty Reward Ready\!"_ sẽ tự động hiển thị ngay giữa màn hình. Người chơi bấm nút "START" trên popup để tiến thẳng vào Shoot Out Free Spins.

## **9.5. Logic UI và VFX**

- **Giao diện (UI):** Bounty Bar (Thanh thu thập) hiển thị trên góc trái màn hình chính. Cấu trúc gồm 100 mốc tiến trình (hiển thị dạng X / 100).
- **Hiệu ứng thu thập (VFX/SFX)**: Khi thu thập thành công, tờ lệnh truy nã trên lưới sẽ bốc cháy nhẹ, hóa thành luồng sáng bay vút lên thanh Bounty Bar. Đi kèm âm thanh tiếng súng nổ (Gunshot) hoặc tiếng đồng xu rơi (Coin chink).
- **Hiệu ứng đạt mốc (100/100):** Thanh Bounty Bar rực sáng màu vàng kim, rung lắc mạnh kèm âm thanh báo hiệu phần thưởng lớn đã sẵn sàng.

## ---

# **10\. Tính năng Đặc biệt: SHERIFF'S STAND RESPIN**

## **10.1. Tên tính năng**

- Sheriff's Stand Respin (Lượt Quay Tử Thần)

## **10.2. Cách kích hoạt (Trigger)**

- Trong quá trình quay Base Game, nếu kết quả vòng quay xuất hiện **đúng 1 biểu tượng Sheriff Badge** ở Cuộn 1 hoặc Cuộn 5, hệ thống có một tỷ lệ % ngẫu nhiên kích hoạt tính năng này.

## **10.3 Reward**

- Ngừoi chơi sẽ nhận 1 được 1 lượt respin

## **10.4. Logic Gameplay**

- **Cơ chế Respin:**
  - **Khóa cuộn (Lock):** Cuộn chứa biểu tượng Sheriff Badge hiện tại cùng toàn bộ 3 cuộn giữa (Cuộn 2, Cuộn 3, Cuộn 4\) sẽ bị khóa cứng (Locked) và giữ nguyên các biểu tượng trên đó.
  - **Quay lại (Respin):** Cuộn duy nhất còn lại (Cuộn 5 hoặc Cuộn 1\) sẽ tự động kích hoạt quay lại đúng 1 lần miễn phí với tốc độ chậm dần (Slow-motion Tease).
- **Phân giải Kết quả:**
  - Trường hợp Thắng (Win): Nếu vòng Respin trả ra biểu tượng Sheriff Badge thứ hai, hệ thống sẽ phát âm thanh báo động và lập tức nâng cấp thành tính năng Shoot Out (Tất cả biểu tượng Low Win trên 3 cuộn giữa biến thành Wild).
  - Trường hợp Thua (Lose): Nếu vòng Respin không ra Sheriff Badge, hiệu ứng Spotlight biến mất, màn hình sáng lại bình thường. Trò chơi tiến hành kiểm tra trả thưởng cho các đường thắng hiện có trên lưới (nếu có) và kết thúc lượt quay.
- **Xử lý ngoại lệ**
  - Tương tác chéo với Wanted Bounty Collection (Giữ nguyên Overlay): Trong trường hợp Thắng (Win) và kích hoạt thành công Shoot Out từ vòng Respin này, hệ thống **vẫn xử lý tương tự như cơ chế Shoot Out gốc**. Cụ thể: Nếu các biểu tượng Low Win ở cuộn 2, 3 và 4 đang bị đính kèm lớp phủ Wanted Poster và bị biến đổi thành Wild, lớp phủ Wanted Poster này **VẪN SẼ ĐƯỢC GIỮ LẠI**. Hệ thống sẽ tiến hành tính tiền thắng và thu thập Wanted Poster đó vào thanh Bounty Bar bình thường.

## ---

# **11\. Tính năng Đặc biệt: GAMEPLAY HISTORY**

## **11.1. Tên tính năng:**

- ## **USER GAMEPLAY HISTORY**

## **11.2. Cách kích hoạt (Trigger)**

- Người chơi nhấn vào nút menu sổ xuống trong giao diện game và chọn biểu tượng lịch sử.
- Tính năng có thể truy cập bất cứ lúc nào khi người chơi không trong trạng thái đang thực hiện vòng quay (Spinning).

## **11.3. Logic Gameplay**

- Hệ thống hiển thị dữ liệu lịch sử theo cấu trúc 2 cấp độ (Level) để người dùng dễ dàng tra cứu:
  - **Cấp độ 1: Spin History**
    - Hiển thị danh sách các lượt spin của users
    - **Dữ liệu hiển thị:**
      - **Date/Time**
      - **Transaction:**
        - Mỗi Spin được khởi tạo với một Transaction ID; nếu Spin đó kích hoạt Free Spins, Respin thì toàn bộ các lượt quay này sẽ dùng chung Transaction ID ban đầu, không tạo transaction mới.
      - **Status:**
        - Bet: Tổng số tiền bet của users trong lượt spin đó.
        - Win: Tổng số tiền thắng của users trong lượt spin đó
        - Profit: Thể hiện lời hay lỗ của users sau 1 lượt spin
          - Công thức: Win \- Bet \= Profit
      - Nút "Details" để chuyển sang trang show chi tiết lượt spin đó.
    - **Website History Link**
      - Bên cạnh tiêu đề Game History, hiển thị đường dẫn "See Full Spin History on the Website".
      - Khi người chơi nhấn vào đường dẫn này, hệ thống sẽ điều hướng người chơi đến trang lịch sử chơi trên website.
      - Trang website hiển thị đầy đủ lịch sử spin của người chơi theo quy định của nền tảng.
  - **Cấp độ 2: Detail spin**
    - Khi chọn một 1 lượt spin, danh sách chi tiết sẽ hiện ra.
    - **Dữ liệu hiển thị:**
      - **Title**: Thể hiện loại spin:
        - Normal Spin
        - Hunter Spins
        - Gunslinger Spins
        - Shootout
        - Shootout Gunslinger Spins
        - Shootout Hunter Spins
        - Buy Feature
      - **Round:** Số thứ tự vòng quay trong cùng một transaction (có cùng Spin/Transaction ID)
        - Ví dụ:
          - Free Spins 5 vòng → Transaction ID chung → 5 round
          - Buy Feature mở ra nhiều spin → Transaction ID chung → nhiều round
          - Quay normal sẽ mặc định là 1 round.
      - **Timestamp:** thời gian quay vòng đó
      - **1 cột ngang trong đó có:**
        - Bet: Tổng số tiền bet của users trong lượt spin đó.
        - Win: Tổng số tiền thắng của users trong lượt spin đó
        - Profit: Thể hiện lời hay lỗ của users sau 1 lượt spin
        - Balance: Thể hiện balance của users
      - Sau đó hiển thị hình kết quả lưới sau khi kết thúc 1 lượt spin
      - Hiển thị danh sách các win ways trên lưới đó
        - Nếu tổng số win ways nhỏ hơn hoặc bằng 6\. Mỗi win ways sẽ kèm theo số hiệu đường, biểu tượng tạo thắng và tổng tiền thắng trên đường đó.
        - Nếu tổng số win ways lớn hơn 6, giao diện sẽ chỉ hiển thị 6 đường thắng đầu tiên kèm cuộn (scroll bar) hoặc nút next/prev để người chơi duyệt các đường thắng còn lại, đồng thời vẫn giữ đầy đủ thông tin về win ways, biểu tượng và tiền thưởng.
      - **Case Maximum win cap**
        - Bên dưới hiển thị các win wayss sẽ hiện thông báo:
          - “Maximum Win Cap reached. Only \<X\> has been awarded for this spin.”
            - \<X\> \= Win cap x Bet Amount
  - Nút “Full Details" để chuyển sang trang web chi tiết lượt spin đó.
  - Hệ thống lịch sử chơi của users chỉ hiển thị dữ liệu 120 record từ lần quay gần nhất của users.

---

# **12\. Giao diện & Trải nghiệm Người dùng (UI/UX)**

## **12.1. Bố cục (Layout)**

- **Nền:** Chủ đạo là tông xám chì của nòng súng, vàng ệch của cát bụi, điểm xuyết màu đỏ bầm của máu và màu vàng kim của tiền thưởng để tạo độ tương phản mạnh (Highlight) mỗi khi trúng thưởng lớn.
- **Khung Slot:** Lưới slot 3-4-4-4-3 được thiết kế như mặt tiền của một quán Saloon tồi tàn bằng gỗ mục, với các lỗ đạn ghim lỗ chỗ.
- **Giao diện điều khiển:** Nằm ở phía dưới, các nút bấm được thiết kế theo chủ đề của game gốc
- **Hiển thị thông tin:** Số dư (Balance), Tổng cược (Total Bet), Tiền thắng (Win), được hiển thị rõ ràng.
- 1 Ô hiển thị nằm ở trên cùng khung slot sẽ hiển thị thông tin các ways win và biến đổi realtime theo từng lượt quay.
- Ô hiển thị nằm dưới slot quay sẽ có các trạng thái sau:
  - Trạng thái "Chờ" hoặc " Vòng quay Đang quay"
    - **Hành động:** Chữ chạy ngang (scroll) từ phải sang trái hoặc hiện tĩnh.
    - **Màu sắc:** Thường là nền xanh lá hoặc màu tối trung tính.
    - **Nội dung hiển thị:** Nó chạy các dòng chữ giới thiệu các tính năng đặc biệt (USP) của game để kích thích người chơi.
      - Win up to 576 Ways
      - 3 or more Scatters will trigger 8 or more Free Spins
      - Win up to 13950 x Bet
  - Trạng thái "Vừa trúng thưởng"
    - **Hành động:** Dòng chữ hướng dẫn biến mất lập tức. Số tiền nhảy ra.
    - **Màu sắc:** Chuyển sang màu để tạo sự nổi bật, báo hiệu tiền về.
    - **Nội dung:** Hiển thị chữ **"WIN"** kèm số tiền thắng tổng của ways win.
  - Trạng thái "Kết thúc lượt" (Tổng kết).Khi chuỗi (combo) kết thúc và không còn biểu tượng nào thắng nữa.
    - **Hành động:** Số tiền dừng lại, cố định.
    - **Màu sắc:** Có thể chuyển sang màu đỏ/vàng nếu số tiền lớn, hoặc giữ nguyên màu xanh.
    - **Nội dung:** Hiển thị **"TOTAL WIN"** (Tổng thắng) \+ tổng số tiền của lượt quay đó.

## **12.2. Hiệu ứng & Âm thanh (Animation & SFX)**

- **Âm thanh nền:** Nhạc nhẹ nhàng, sôi động.
- **Hiệu ứng quay:** Âm thanh các cuộn quay nhanh.
- **Hiệu ứng Hiển thị win ways:**
  - Hiệu ứng này được kích hoạt khi một tổ hợp thắng (winning combination) xuất hiện trên các cuộn quay. Mục đích là để làm nổi bật các biểu tượng tạo nên chiến thắng và tổng số tiền thắng cược.
  - **Kích hoạt và Sự kiện Đồng thời:**
    - **Kích hoạt:** Ngay sau khi các cuộn quay dừng lại và hệ thống xác định có ít nhất một win ways thắng.
    - **Âm thanh:** Kèm theo là âm thanh "thắng cược" (win/chime sound) để báo hiệu chiến thắng.
  - **Hiệu ứng làm nổi bật Biểu tượng**
    - Hiệu ứng Biểu tượng (Symbol Animation):
      - Các biểu tượng thắng có thể có một hoạt ảnh nhỏ riêng biệt (ví dụ: phóng to/thu nhỏ nhẹ, rung lắc nhẹ, hoặc một hiệu ứng "sáng lên" bên trong) để tăng thêm sự chú ý.
  - **Hiển thị Giá trị Thắng Tổng (Total Win Display)**
    - Hệ thống sẽ xác định số chữ số của tổng tiền thắng và áp dụng animation tương ứng:
      - **Thắng nhỏ (1–2 chữ số)**
        - Điều kiện: Tổng tiền thắng có 1 hoặc 2 chữ số.
        - Animation áp dụng:
          - Chỉ chạy animation hiển thị (Appear Animation).
      - **Thắng trung bình (3 chữ số)**
        - Điều kiện: Tổng tiền thắng có 3 chữ số.
        - Animation áp dụng (theo thứ tự):
          - Animation hiển thị (Appear Animation).
          - Animation hiện lần lượt từng chữ số (Digit Reveal Animation).
          - Animation đếm số tăng dần từ giá trị nhỏ đến tổng tiền thắng (Count-up Animation).
    - **Thắng lớn (4 chữ số trở lên)**
      - Điều kiện: Tổng tiền thắng có từ 4 chữ số trở lên.
      - Animation áp dụng:
        - Animation hiện lần lượt từng chữ số (Digit Reveal Animation).
        - Animation đếm số tăng dần từ giá trị nhỏ lên tổng tiền thắng (Count-up Animation).
- [**Hiệu ứng Paytable Tooltip:**](https://drive.google.com/file/d/1YcGsB5rMAr4dHtAOfWp9kds-Dxwl4RDU/view?usp=sharing)
  - **Tooltip xuất hiện khi:**
    - User tab vào một biểu tượng bất kỳ trên reels
    - Không hiển thị trong lúc các cuộn đang quay.
  - **Tooltip xuất hiện khi:**
    - Người chơi ngừng hover / tap.
    - Người chơi chuyển sang biểu tượng khác
  - **Vị trí hiển thị:**
    - Tooltip được canh ngang với vị trí biểu tượng.
    - Ưu tiên hiển thị bên phải biểu tượng.
    - Nếu thiếu không gian (ví dụ sát mép phải), tooltip chuyển sang hiển thị bên trái.
    - Tooltip luôn nằm trong vùng an toàn UI (không vượt ra ngoài màn hình).
  - **Nội dung hiển thị:**
    - Danh sách mức trả thưởng của từng biểu tượng
      - _Lưu ý giá trị này sẽ thay đổi theo mức bet_
- **In Free Spins Mode:**
  - Giao diện game thay đổi
  - Một bộ đếm nổi bật hiển thị số vòng quay còn lại (ví dụ: "Spins Left: 10").
- **Hiệu ứng kích hoạt Free Spins:** Khi 3 biểu tượng Scatter xuất hiện, chúng sẽ hoạt họa và một pop-up lớn sẽ hiện ra thông báo "10 FREE SPINS WON\!".

## **12.3. Trạng thái UI**

- [**Hiệu ứng Reward:**](https://drive.google.com/file/d/16mcD3kbCnxT3z4UYKYKQ8ceFCKrFBPc2/view?usp=sharing)
  - **Bộ đếm tiền thắng (Payout Ticker)**:
    - Sẽ khởi động ngay sau khi kết thúc tính toán tiền thắng.
    - Bộ đếm này chạy lên từ 0 đến **Tổng tiền thắng cuối cùng của người chơi**.
  - **Ngưỡng Win Effect theo Total Bet:**
    - **Effect Threshold \= Base Threshold × (Base Bet / Reference Bet)**
  - **Base Threshold:** Ngưỡng mặc định gốc ($) – ví dụ $20, $40, $80, $100 (tương ứng Big/Mega/Booming/Legendary Win).
  - **Reference Bet:** Mức cược tham chiếu để định nghĩa Base Threshold (ví dụ $1).
  - **Base Bet:** Mức cược hiện tại mà người chơi đã chọn cho vòng quay.
  - Ví dụ

| Win Effect        | Base Threshold | Reference Bet | Base bet \= 2 | Base Bet \= 5 |
| :---------------- | :------------- | :------------ | :------------ | :------------ |
| **Big Win**       | **50**         | **1**         | **100**       | **250**       |
| **Mega Win**      | **75**         | **1**         | **150**       | **375**       |
| **Legendary Win** | **100**        | **1**         | **200**       | **500**       |

- **Kích hoạt hiệu ứng:**
  - Big Win: Khi bộ đếm đạt hoặc vượt Base $50 × (Base Bet / Reference Bet)
  - Mega Win: Khi bộ đếm đạt hoặc vượt Base $75 × (Base Bet / Reference Bet)
  - Legendary Win: Khi bộ đếm đạt hoặc vượt Base $100 × (Base Bet / Reference Bet)
    - _Note: thời gian diễn hiệu ứng của từng mốc sẽ là 8s._
- **Nguyên tắc Ghi đè (Override):** Khi bộ đếm tiếp tục chạy và đạt hoặc vượt qua một ngưỡng cao hơn (ví dụ: từ $30.00 lên $50.00), hiệu ứng thắng lớn mới (**Booming Win**) sẽ **TỰ ĐỘNG GHI ĐÈ (override)** và thay thế ngay lập tức hiệu ứng đang hiển thị.
- **Hoàn tất:** Chuỗi hiệu ứng sẽ chạy liên tục, tự động nâng cấp (escalate) khi chạm mốc, cho đến khi bộ đếm dừng lại ở giá trị Tổng tiền thắng cuối cùng.
- Nếu đang trong Freespin chạy xong hiệu ứng này mới chạy **Free Spin Summary**.

---

# **13 Mô hình Toán học (Mathematical Model)**

## **13.1. Mục tiêu RTP Tổng (Total RTP Target)**

RTP (Return To Player) là tỷ lệ phần trăm tổng số tiền cược sẽ được trả lại cho người chơi qua các vòng quay về lâu dài.

- **RTP Tổng mục tiêu:** **96.00%**
