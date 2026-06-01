import 'dart:convert';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../theme/app_theme.dart';

class AiPlannerScreen extends StatefulWidget {
  const AiPlannerScreen({super.key});

  @override
  State<AiPlannerScreen> createState() => _AiPlannerScreenState();
}

class _AiPlannerScreenState extends State<AiPlannerScreen> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _isTyping = false;

  // 📝 UI 顯示用的對話紀錄
  final List<Map<String, dynamic>> _uiMessages = [];
  // 📝 傳給後端 API 的對話紀錄 (與網站完全相同)
  final List<Map<String, dynamic>> _apiMessages = [];

  String? _selectedTitle;
  String? _selectedDesc;

  @override
  void initState() {
    super.initState();
    // 一啟用就打招呼
    _uiMessages.add({
      "role": "assistant",
      "text": "您好！我是您的 AI 旅遊助理 ✈️\n請問您想去哪裡玩？預計去幾天？或者告訴我您喜歡什麼樣的旅遊風格呢？"
    });
  }

  String _getBaseUrl() {
    if (kIsWeb) return 'http://localhost:8888';
    if (Platform.isAndroid) return 'http://10.0.2.2:8888';
    return 'http://127.0.0.1:8888';
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  // 🚀 發送訊息給後端 API (完全依賴你寫好的預提示詞)
  Future<void> _sendMessage(String text, {String? hiddenPrompt}) async {
    if (text.trim().isEmpty && hiddenPrompt == null) return;

    final displayText = text;
    final apiText = hiddenPrompt ?? text;

    setState(() {
      _uiMessages.add({"role": "user", "text": displayText});
      _isTyping = true;
    });
    _textController.clear();
    _scrollToBottom();

    _apiMessages.add({"role": "user", "content": apiText});

    final token = Provider.of<AuthProvider>(context, listen: false).token;
    try {
      final res = await http.post(
        Uri.parse('${_getBaseUrl()}/api/chat'),
        headers: {
          'Content-Type': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          "messages": _apiMessages,
          "currentPlan": {"city": "未決定"} // 依賴後端判定機制
        }),
      );

      final data = jsonDecode(res.body);
      setState(() => _isTyping = false);

      if (data['proposals'] != null) {
        _uiMessages.add({
          "role": "assistant",
          "text": data['content'] ?? "為您準備了以下 3 個提案，請點選您最喜歡的一個：",
          "proposals": data['proposals']
        });
        _apiMessages.add({"role": "assistant", "content": "已提供提案供選擇。"});
      } else if (data['plan'] != null) {
        _uiMessages.add({
          "role": "assistant",
          "text": data['content'] ?? "🎉 行程已經為您詳細規劃完畢！",
          "plan": data['plan']
        });
        _apiMessages.add({"role": "assistant", "content": "已提供詳細行程。"});
        // 💾 背景自動存檔
        _savePlanToDb(data['plan']);
      } else {
        final reply = data['content'] ?? "不好意思，我還在學習中。";
        _uiMessages.add({"role": "assistant", "text": reply});
        _apiMessages.add({"role": "assistant", "content": reply});
      }
      _scrollToBottom();
    } catch (e) {
      debugPrint('Chat error: $e');
      setState(() {
        _isTyping = false;
        _uiMessages.add({"role": "assistant", "text": "連線發生錯誤，請檢查網路後再試。"});
      });
      _scrollToBottom();
    }
  }

  // 🎯 使用者點擊提案後，套用你的嚴格提示詞要求展開行程
  void _onProposalSelected(Map<String, dynamic> proposal) {
    _selectedTitle = proposal['title'];
    _selectedDesc = proposal['description'];

    final summariesText = (proposal['daySummaries'] as List<dynamic>? ?? [])
        .asMap().entries.map((e) => '第 ${e.key + 1} 天核心主軸：${e.value}').join('\n');
    final expectedDays = proposal['daySummaries']?.length ?? 3;

    // 這裡就是你網站前端用的那套防出軌預提示詞
    final strictPrompt = '我選定了方案：【${proposal['title']}】。\n'
        '請根據以下這 $expectedDays 天的每日主軸，為我展開「每一天」的具體行程：\n'
        '----------------\n$summariesText\n----------------\n'
        '⚠️【極度重要限制】：\n1. 天數精確等於 $expectedDays 天\n2. 每天安排3~4個不同地點，交通距離必須合理\n3. 嚴禁重複地點\n4. 🛑絕對禁止跨國與極端移動\n5. 繁體中文輸出\n'
        '請立刻呼叫 update_itinerary 工具。';

    // UI 上只顯示簡短的話，背後傳送嚴格的 prompt 給 API
    _sendMessage("我選定了：【${proposal['title']}】，請幫我產生詳細行程！", hiddenPrompt: strictPrompt);
  }

  // 💾 將產生的行程存入資料庫
  Future<void> _savePlanToDb(Map<String, dynamic> plan) async {
    final token = Provider.of<AuthProvider>(context, listen: false).token;
    try {
      await http.post(
        Uri.parse('${_getBaseUrl()}/api/itineraries'),
        headers: { 'Content-Type': 'application/json', if (token != null) 'Authorization': 'Bearer $token' },
        body: jsonEncode({
          "title": _selectedTitle ?? 'AI 客製化行程',
          "summary": _selectedDesc ?? '',
          "city": plan['city'] ?? '',
          "itineraryData": plan,
          "tripNote": _selectedDesc ?? '',
        }),
      );
    } catch (e) {
      debugPrint('Save error: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('✨ AI 行程精靈', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
      ),
      body: Column(
        children: [
          // 💬 聊天訊息列表
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(16),
              itemCount: _uiMessages.length + (_isTyping ? 1 : 0),
              itemBuilder: (context, index) {
                if (index == _uiMessages.length && _isTyping) {
                  return _buildTypingIndicator();
                }
                final msg = _uiMessages[index];
                return _buildChatBubble(msg);
              },
            ),
          ),
          // ⌨️ 輸入框區域
          Container(
            padding: EdgeInsets.only(left: 16, right: 16, top: 12, bottom: 12 + MediaQuery.of(context).viewPadding.bottom),
            decoration: const BoxDecoration(color: Colors.white, boxShadow: [BoxShadow(color: Color(0x14000000), blurRadius: 12, offset: Offset(0, -2))]),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _textController,
                    decoration: InputDecoration(
                      hintText: '告訴我你想去哪裡...',
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                    ),
                    onSubmitted: (text) => _sendMessage(text),
                  ),
                ),
                const SizedBox(width: 8),
                CircleAvatar(
                  backgroundColor: AppColors.orange,
                  child: IconButton(
                    icon: const Icon(Icons.send, color: Colors.white, size: 20),
                    onPressed: () => _sendMessage(_textController.text),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // 🧱 渲染對話泡泡與卡片
  Widget _buildChatBubble(Map<String, dynamic> msg) {
    final bool isUser = msg['role'] == 'user';

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (!isUser) ...[
                const CircleAvatar(backgroundColor: AppColors.orange, radius: 16, child: Icon(Icons.auto_awesome, color: Colors.white, size: 18)),
                const SizedBox(width: 8),
              ],
              Flexible(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: isUser ? AppColors.orange : Colors.white,
                    borderRadius: BorderRadius.circular(16).copyWith(
                      bottomRight: isUser ? const Radius.circular(0) : const Radius.circular(16),
                      bottomLeft: !isUser ? const Radius.circular(0) : const Radius.circular(16),
                    ),
                    boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2))],
                  ),
                  child: Text(
                    msg['text'] ?? '',
                    style: TextStyle(fontSize: 15, color: isUser ? Colors.white : Colors.black87, height: 1.4),
                  ),
                ),
              ),
            ],
          ),
          
          // 渲染 3 個提案的橫向滑動卡片
          if (msg['proposals'] != null)
            Container(
              height: 220,
              margin: const EdgeInsets.only(top: 12, left: 40),
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: (msg['proposals'] as List).length,
                itemBuilder: (context, idx) {
                  final p = msg['proposals'][idx];
                  return Container(
                    width: 260,
                    margin: const EdgeInsets.only(right: 12),
                    child: Card(
                      color: Colors.white,
                      elevation: 2,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(p['title'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.text), maxLines: 2, overflow: TextOverflow.ellipsis),
                            const SizedBox(height: 8),
                            Expanded(child: Text(p['description'] ?? '', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary), maxLines: 3, overflow: TextOverflow.ellipsis)),
                            SizedBox(
                              width: double.infinity,
                              child: OutlinedButton(
                                onPressed: () => _onProposalSelected(p),
                                child: const Text('選擇此方案'),
                              ),
                            )
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),

          // 渲染跳轉行程的按鈕
          if (msg['plan'] != null)
            Padding(
              padding: const EdgeInsets.only(top: 12, left: 40),
              child: FilledButton.icon(
                onPressed: () {
                  Navigator.pop(context, true); // 退回首頁，讓首頁自動刷新顯示新行程
                },
                icon: const Icon(Icons.check_circle),
                label: const Text('行程已儲存！點擊返回首頁查看'),
              ),
            )
        ],
      ),
    );
  }

  Widget _buildTypingIndicator() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        children: [
          const CircleAvatar(backgroundColor: Color(0xFF0F766E), radius: 16, child: Icon(Icons.auto_awesome, color: Colors.white, size: 18)),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16).copyWith(bottomLeft: const Radius.circular(0)), boxShadow: const [BoxShadow(color: Color(0x14000000), blurRadius: 4, offset: Offset(0, 2))]),
            child: const Text('AI 正在思考中...', style: TextStyle(color: AppColors.textSecondary, fontStyle: FontStyle.italic)),
          ),
        ],
      ),
    );
  }
}