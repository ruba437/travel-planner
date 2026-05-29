import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/planner_provider.dart';
import 'itinerary_screen.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _textController = TextEditingController();
  final _scrollController = ScrollController();

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

  // 🆕 核心強效跳轉機制：跳出強制讀取圈圈，並在完成時百分之百執行跳轉
  Future<void> _executePlanGeneration(Future<bool> task) async {
    // 1. 跳出強制阻斷的載入視窗，避免使用者亂點，同時鎖定當前的 BuildContext
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const PopScope(
        canPop: false, // 禁用返回鍵，確保安全
        child: Center(
          child: Card(
            child: Padding(
              padding: EdgeInsets.all(24.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(color: Color(0xFF0F766E)),
                  SizedBox(height: 16),
                  Text('AI 正在為您量身打造行程...', style: TextStyle(fontWeight: FontWeight.bold)),
                ],
              ),
            ),
          ),
        ),
      ),
    );

    // 2. 執行 AI 規劃任務
    final bool success = await task;

    // 3. 關閉剛剛的載入視窗
    if (mounted) {
      Navigator.of(context).pop();
    }

    // 4. 只要成功拿到 Plan，強制推入 ItineraryScreen 畫面！
    if (success && mounted) {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (context) => const ItineraryScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final planner = Provider.of<PlannerProvider>(context);

    _scrollToBottom();

    return Scaffold(
      appBar: AppBar(
        title: const Text('AI 旅遊規劃助理'),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 1,
        actions: [
          if (planner.currentPlan != null)
            Padding(
              padding: const EdgeInsets.only(right: 8.0),
              child: TextButton.icon(
                icon: const Icon(Icons.calendar_month, color: Color(0xFF0F766E)),
                label: const Text('查看行程', style: TextStyle(color: Color(0xFF0F766E), fontWeight: FontWeight.bold)),
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (context) => const ItineraryScreen()),
                  );
                },
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(16),
              itemCount: planner.messages.length + (planner.currentProposals != null ? 1 : 0),
              itemBuilder: (context, index) {
                if (index == planner.messages.length) {
                  return _buildProposalCards(planner, auth.token ?? '');
                }

                final msg = planner.messages[index];
                final isUser = msg['role'] == 'user';
                return _buildChatBubble(isUser, msg['content'] ?? '');
              },
            ),
          ),
          if (planner.isSending)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8.0),
              child: Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))),
            ),
          _buildInputArea(planner, auth.token ?? ''),
        ],
      ),
    );
  }

  Widget _buildChatBubble(bool isUser, String content) {
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        decoration: BoxDecoration(
          color: isUser ? const Color(0xFF0F766E) : Colors.grey[200],
          borderRadius: BorderRadius.circular(16).copyWith(
            bottomRight: isUser ? const Radius.circular(0) : const Radius.circular(16),
            topLeft: isUser ? const Radius.circular(16) : const Radius.circular(0),
          ),
        ),
        child: Text(
          content,
          style: TextStyle(
            color: isUser ? Colors.white : Colors.black87,
            fontSize: 16,
          ),
        ),
      ),
    );
  }

  Widget _buildProposalCards(PlannerProvider planner, String token) {
    final proposals = planner.currentProposals ?? [];
    
    return Container(
      height: 220,
      margin: const EdgeInsets.symmetric(vertical: 16),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: proposals.length,
        itemBuilder: (context, idx) {
          final p = proposals[idx];
          
          return Container(
            width: 260,
            margin: const EdgeInsets.only(right: 16),
            child: Card(
              elevation: 4,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              color: Colors.white,
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      p['title'] ?? '精選提案',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F766E)),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    Expanded(
                      child: Text(
                        p['description'] ?? '',
                        style: const TextStyle(fontSize: 14, color: Colors.black54),
                        maxLines: 4,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0F766E),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        // 🆕 修改：按下去時，使用客製化的 _executePlanGeneration 接管非同步跳轉
                        onPressed: planner.isSending 
                            ? null 
                            : () => _executePlanGeneration(planner.expandPlanDetail(p, token)),
                        child: const Text('選擇此方案', style: TextStyle(fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildInputArea(PlannerProvider planner, String token) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Colors.black12)),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _textController,
              decoration: const InputDecoration(
                hintText: '輸入目的地、天數（如：東京玩5天）...',
                border: InputBorder.none,
              ),
              onSubmitted: (text) {
                if (!planner.isSending && text.trim().isNotEmpty) {
                  final msg = _textController.text;
                  _textController.clear();
                  // 🆕 修改：按下 Enter 時同樣交給 _executePlanGeneration 控制
                  _executePlanGeneration(planner.handleSend(msg, token));
                }
              },
            ),
          ),
          IconButton(
            icon: const Icon(Icons.send, color: Color(0xFF0F766E)),
            onPressed: planner.isSending
                ? null
                : () {
                    final msg = _textController.text;
                    if (msg.trim().isEmpty) return;
                    _textController.clear();
                    // 🆕 修改：點擊發送按鈕時交給 _executePlanGeneration 控制
                    _executePlanGeneration(planner.handleSend(msg, token));
                  },
          ),
        ],
      ),
    );
  }
}