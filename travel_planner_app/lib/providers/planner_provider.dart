import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
import 'dart:io' show Platform;

class PlannerProvider with ChangeNotifier {
  // 動態對齊你的後端 Port
  String get _baseUrl {
    if (kIsWeb) return 'http://localhost:8888';
    if (Platform.isAndroid) return 'http://10.0.2.2:8888';
    return 'http://127.0.0.1:8888';
  }

  // 儲存對話紀錄，預設有一句歡迎詞
  List<Map<String, String>> _messages = [
    {'role': 'assistant', 'content': '嗨，我是旅遊小助手！我可以幫你安排行程。'}
  ];
  bool _isSending = false;
  dynamic _currentPlan; // 用來存放 AI 生成的 JSON 行程資料
  List<dynamic>? _currentProposals; // 用來存放 3 個城市的初步提案

  List<Map<String, String>> get messages => _messages;
  bool get isSending => _isSending;
  dynamic get currentPlan => _currentPlan;
  List<dynamic>? get currentProposals => _currentProposals;

  // 🆕 新增這個函數：對應 React 版的 expandPlanDetail
  Future<void> expandPlanDetail(dynamic proposal, String token) async {
    _isSending = true;
    notifyListeners();

    // 1. 抓取這筆提案的資訊
    final String proposalTitle = proposal['title'] ?? '選定方案';
    final int expectedDays = (proposal['daySummaries'] as List?)?.length ?? 3; // 預設 3 天
    
    // 建立每日大綱的文字提示詞，拿來逼 AI 不要偷懶
    final List<dynamic> summaries = proposal['daySummaries'] ?? [];
    String summariesText = '';
    for (int i = 0; i < summaries.length; i++) {
      summariesText += '第 ${i + 1} 天核心主軸：${summaries[i]}\n';
    }

    // 2. 建立要塞給 AI 的強制指令（把我們在 React 版調整完美的 Prompt 搬過來）
    final String prompt = [
      '我選定了方案：【$proposalTitle】。',
      '請根據以下這 $expectedDays 天的每日主軸，為我展開「每一天」的具體行程：',
      '----------------',
      summariesText.isNotEmpty ? summariesText : '請確保這 $expectedDays 天每天都有截然不同的行程。',
      '----------------',
      '⚠️【極度重要限制 - 嚴禁偷懶】：',
      '1. 旅遊總天數必須「精確等於 $expectedDays 天」，請產出 Day 1 到 Day $expectedDays 完整的 JSON。',
      '2. 每一天都必須安排 3~4 個「完全不同」的具體地點。',
      '3. 全程「嚴禁重複任何地點」！絕對不可以把第一天的景點複製到第二天或第三天。',
      '4. 必須使用「繁體中文」產出所有景點名稱、說明與概要。',
      '請立刻呼叫 update_itinerary 工具產出結果。'
    ].join('\n');

    // 3. 把這句選定方案的指令加進對話紀錄裡
    _messages.add({'role': 'user', 'content': '我選定了方案：【$proposalTitle】，開始生成詳細行程！'});

    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/api/chat'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'messages': [
            ..._messages.sublist(0, _messages.length - 1), // 扣掉剛剛手動加的，改放詳細的 Prompt 帶去後端
            {'role': 'user', 'content': prompt}
          ],
          'currentPlan': {'days': List.filled(expectedDays, {})} // 給後端一個基本背景天數
        }),
      );

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        
        if (data['content'] != null) {
          _messages.add({'role': 'assistant', 'content': data['content']});
        }
        
        // 🚨 成功拿到詳細行程 JSON！
        if (data['plan'] != null) {
          _currentPlan = data['plan'];
          _currentProposals = null; // 既然選好了，就把 3 個提案卡片收起來
        }
      } else {
        _messages.add({'role': 'assistant', 'content': '產生行程失敗，後端未正確回傳。'});
      }
    } catch (e) {
      print('展開行程錯誤: $e');
      _messages.add({'role': 'assistant', 'content': '連線錯誤，無法產生詳細行程。'});
    } finally {
      _isSending = false;
      _currentProposals = null; // 關閉卡片
      notifyListeners();
    }
  }

  // 發送訊息給 AI (對應 React 版的 handleSend)
  Future<void> handleSend(String text, String token) async {
    if (text.trim().isEmpty || _isSending) return;

    // 1. 先把使用者的訊息加進對話列表，讓畫面立刻顯示
    _messages.add({'role': 'user', 'content': text});
    _isSending = true;
    notifyListeners(); // 刷新 UI

    try {
      // 2. 發送請求給你的 Node.js 後端
      final res = await http.post(
        Uri.parse('$_baseUrl/api/chat'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'messages': _messages,
          'currentPlan': _currentPlan, // 帶入目前的行程背景
        }),
      );

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);

        // 3. 處理 AI 的文字回覆
        if (data['content'] != null) {
          _messages.add({'role': 'assistant', 'content': data['content']});
        }

        // 4. 處理 AI 回傳的方案提案 (Proposals)
        if (data['proposals'] != null) {
          _currentProposals = data['proposals'];
          // 這裡我們之後可以做成漂亮的卡片讓使用者選城市！
        }

        // 5. 處理 AI 回傳的詳細 JSON 行程 (Plan)
        if (data['plan'] != null) {
          _currentPlan = data['plan'];
          // 這裡就是我們之前清洗過、完美的詳細行程資料！
        }
      } else {
        _messages.add({'role': 'assistant', 'content': '抱歉，連線後端失敗了，請稍後再試。'});
      }
    } catch (e) {
      print('AI 請求失敗: $e');
      _messages.add({'role': 'assistant', 'content': '連線發生錯誤，請檢查網路。'});
    } finally {
      _isSending = false;
      notifyListeners(); // 再次刷新 UI
    }
  }

  // 清空聊天室 (開新行程用)
  void clearChat() {
    _messages = [
      {'role': 'assistant', 'content': '嗨，我是旅遊小助手！我可以幫你安排行程。'}
    ];
    _currentPlan = null;
    _currentProposals = null;
    notifyListeners();
  }
}