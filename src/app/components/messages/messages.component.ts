import { Component, DoCheck, HostBinding, OnInit, OnDestroy, ViewChild, ElementRef, inject, signal, computed, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { UsersService } from '../../services/users.service';
import { AddChatModalComponent } from '../add-chat-modal/add-chat-modal.component';
import { supabase } from '../../core/supabase.client';
import { SidebarService } from '../../services/sidebar.service';
import { UserModel } from '../../models/database-models/user.model';
import { ConversationParticipantModel, ConversationWithDetailsModel, MessageWithSenderModel } from '../../models/helper-models/message.model';
import { MessagesService } from '../../services/messages.service';
import { MessageModel } from '../../models/database-models/message.model';
import { ConversationModel, ConversationsService } from '../../services/conversations.service';
import { MessageComponent } from '../templates/message/message.component';
import { PostDetailModalComponent } from '../post-detail-modal/post-detail-modal.component';
import { ShareRatingModalComponent } from '../share-rating-modal/share-rating-modal.component';
import { PostWithRating } from '../../models/helper-models/post-with-ratings.interface';
import { RatingModel } from '../../models/database-models/rating.model';
import { ModalOverlayService } from '../../services/modal-overlay.service';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, FormsModule, AddChatModalComponent, MessageComponent, PostDetailModalComponent, ShareRatingModalComponent],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.css'
})
export class MessagesComponent implements OnInit, OnDestroy, DoCheck {
  // Message loading
  messages = signal<MessageModel[]>([]);
  isLoadingMessages = signal(false);
  hasMoreMessages = signal(true);
  messageCount = 0;
  private realtimeChannel: any;

  // Scroll detection
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  private isLoadingMore = false;
  private messagesService = inject(MessagesService);
  private usersService = inject(UsersService);
  public sidebarService = inject(SidebarService);
  private conversationsService = inject(ConversationsService);
  private modalOverlayService = inject(ModalOverlayService);
  private route = inject(ActivatedRoute);

  // State
  conversations = signal<ConversationWithDetailsModel[]>([]);
  activeConversation = signal<ConversationWithDetailsModel | null>(null);
  activeConversationId = signal<string | null>(null);
  public currentUser = signal<UserModel | null>(null);
  currentUserId = signal<string | null>(null);

  // UI state
  searchTerm = '';
  messageInput = '';
  showAddChatModal = false;
  isLoadingConversations = signal(false);
  
  // Track if initial page load is complete (for shimmer display)
  initialLoadComplete = signal(false);

  // Reply state
  replyingToMessage = signal<MessageModel | null>(null);

  // Edit state
  editingMessageId = signal<string | null>(null);

  // Menu state
  openMenuId: string | null = null;

  // Delete modal state
  showDeleteModal = false;
  conversationToDelete: ConversationWithDetailsModel | null = null;

  // Leave group modal state
  showLeaveGroupModal = false;
  conversationToLeave: ConversationWithDetailsModel | null = null;

  // Recover chat modal state
  showRecoverModal = false;
  deletedConversations = signal<ConversationWithDetailsModel[]>([]);
  isLoadingDeletedConversations = signal(false);
  conversationToRecover: ConversationWithDetailsModel | null = null;
  showConfirmRecoverModal = false;

  // Edit group modal state
  showEditGroupModal = false;
  editingConversation = signal<ConversationWithDetailsModel | null>(null);
  editGroupName = '';
  editGroupAvatarPreview: string | null = null;
  editGroupAvatarFile: File | null = null;
  originalGroupName = '';
  originalGroupAvatar = '';
  isUploadingGroupAvatar = signal(false);
  isSavingGroupChanges = signal(false);

  // Post detail modal state
  chatPosts = signal<PostWithRating[]>([]);
  selectedPostIndex = signal<number>(0);
  showPostModal = signal(false);

  // Share rating modal state
  showShareModal = false;
  shareRatingData: RatingModel | null = null;

  @HostBinding('class.modal-open')
  get isModalOpen() { return this.showPostModal() || this.showAddChatModal || this.showShareModal || this.showDeleteModal || this.showLeaveGroupModal || this.showEditGroupModal; }

  ngDoCheck() {
    if (this.isModalOpen) this.modalOverlayService.show();
    else this.modalOverlayService.hide();
  }

  selectedPost = computed(() => this.chatPosts()[this.selectedPostIndex()] ?? null);
  canNavigatePrevious = computed(() => this.selectedPostIndex() > 0);
  canNavigateNext = computed(() => this.selectedPostIndex() < this.chatPosts().length - 1);

  // Drag and drop state
  isDraggingOver = signal(false);
  private dragCounter = 0;

  // Real-time subscription
  private conversationSubscription: RealtimeChannel | null = null;

  constructor() {
    // Auto-scroll when new messages arrive
    effect(() => {
      const msgs = this.messages();
      if (msgs.length > 0) {
        // Use requestAnimationFrame to scroll after DOM renders
        requestAnimationFrame(() => this.scrollToBottom());
      }
    });
  }

  // Close menu when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.conversation-menu') && !target.closest('.menu-trigger')) {
      this.openMenuId = null;
    }
  }

  async ngOnInit() {
    const current = await this.usersService.getCurrentUserProfile();
    this.currentUser.set(current);
    this.currentUserId.set(current?.id || null);
    await this.loadConversations();

    // Mark initial load as complete - shimmers won't show after this
    this.initialLoadComplete.set(true);

    // Check for conversationId query param (from notification deep-link)
    const targetConvId = this.route.snapshot.queryParamMap.get('conversationId');
    const targetConv = targetConvId
      ? this.conversations().find(c => c.id === targetConvId)
      : null;

    if (targetConv) {
      await this.selectConversation(targetConv);
    } else if (this.conversations().length > 0) {
      await this.selectConversation(this.conversations()[0]);
    }
  }

  ngOnDestroy() {
    if (this.realtimeChannel) {
      this.messagesService.unsubscribe(this.realtimeChannel);
    }
  }


  // ✅ Change parameter type from ConversationModel to ConversationWithDetailsModel
  async selectConversation(conv: ConversationWithDetailsModel) {
    if (this.realtimeChannel) {
      this.messagesService.unsubscribe(this.realtimeChannel);
    }

    this.activeConversationId.set(conv.id);
    this.activeConversation.set(conv);
    this.cancelReply();
    this.cancelEdit();

    await this.loadInitialMessages(conv.id);
    await this.conversationsService.markAsRead(conv.id);
    this.subscribeToMessages(conv.id);
  }

  async loadInitialMessages(conversationId: string) {
    this.isLoadingMessages.set(true);
    try {
      const { messages, hasMore } = await this.messagesService.getInitialMessages(conversationId);
      this.messages.set(messages);
      this.messageCount = messages.length;
      this.hasMoreMessages.set(hasMore);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      this.isLoadingMessages.set(false);
    }
  }

  async loadOlderMessages() {
    if (this.isLoadingMore || !this.hasMoreMessages() || !this.activeConversationId()) {
      return;
    }

    this.isLoadingMore = true;
    const previousScrollHeight = this.messagesContainer.nativeElement.scrollHeight;

    try {
      const { messages: olderMessages, hasMore } = await this.messagesService.loadOlderMessages(
        this.activeConversationId()!,
        this.messageCount
      );

      if (olderMessages.length > 0) {
        // Prepend older messages
        this.messages.update(current => [...olderMessages, ...current]);
        this.messageCount += olderMessages.length;
        this.hasMoreMessages.set(hasMore);

        // Maintain scroll position
        setTimeout(() => {
          const newScrollHeight = this.messagesContainer.nativeElement.scrollHeight;
          this.messagesContainer.nativeElement.scrollTop = newScrollHeight - previousScrollHeight;
        }, 0);
      }
    } catch (error) {
      console.error('Failed to load older messages:', error);
    } finally {
      this.isLoadingMore = false;
    }
  }

  onScroll(event: Event) {
    const element = event.target as HTMLElement;
    
    // Check if scrolled near top (load more)
    if (element.scrollTop < 100) {
      this.loadOlderMessages();
    }
  }

  subscribeToMessages(conversationId: string) {
    this.realtimeChannel = this.messagesService.subscribeToMessages(
      conversationId,
      (newMessage) => {
        // Add new message
        this.messages.update(current => [...current, newMessage]);
        this.messageCount++;

        // Animate new message
        setTimeout(() => {
          const element = document.getElementById(`message-${newMessage.id}`);
          if (element) {
            element.classList.add('slide-in');
          }
        }, 0);

        // Scroll to bottom if user is near bottom
        setTimeout(() => {
          const container = this.messagesContainer.nativeElement;
          const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
          
          if (isNearBottom) {
            this.scrollToBottom();
          }
        }, 100);
      }
    );
  }

  async sendMessage() {
    if (!this.messageInput.trim() || !this.activeConversationId()) return;

    const content = this.messageInput;
    const replyToId = this.replyingToMessage()?.id || null;
    const replyingTo = this.replyingToMessage();
    const editingId = this.editingMessageId();

    this.messageInput = '';
    this.cancelReply();

    // Handle edit mode
    if (editingId) {
      try {
        await this.messagesService.editMessage(editingId, content);
        this.messages.update(current =>
          current.map(m => m.id === editingId
            ? { ...m, content, updated_at: new Date() }
            : m
          )
        );
        this.editingMessageId.set(null);
      } catch (error) {
        console.error('Failed to edit message:', error);
      }
      return;
    }

    // Define tempMessage
    const tempMessage: MessageModel = {
      id: 'temp-' + Date.now(),
      conversation_id: this.activeConversationId()!,
      sender_id: this.currentUser()!.id,
      content: content,
      created_at: new Date(),
      updated_at: null,
      reply_to_message_id: replyToId,
      replied_message: replyingTo || undefined,
      shared_rating_id: null,
      sender: this.currentUser()!,
      sending: true
    };

    try {
      // Add temp message
      this.messages.update(current => [...current, tempMessage]);
      this.scrollToBottom();

      // Send to server (with reply ID if replying)
      const sentMessage = await this.messagesService.sendTextMessage(
        this.activeConversationId()!,
        content,
        replyToId || undefined
      );

      // Replace temp with real message, preserving replied_message from temp
      this.messages.update(current =>
        current.map(m => m.id === tempMessage.id
          ? { ...sentMessage, replied_message: tempMessage.replied_message }
          : m
        )
      );

    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove temp message on error
      this.messages.update(current =>
        current.filter(m => m.id !== tempMessage.id)
      );
    }
  }

  private scrollToBottom() {
    if (this.messagesContainer) {
      const container = this.messagesContainer.nativeElement;
      container.scrollTop = container.scrollHeight;
    }
  }
  
  async loadConversations() {
    this.isLoadingConversations.set(true);
    try {
      const convos = await this.conversationsService.getConversations();
      const me = this.currentUserId();

      const mapped: ConversationWithDetailsModel[] = await Promise.all(
        convos.map(async (c) => {
          // Load participants for DM avatar/name fallback
          const users = await this.conversationsService.getParticipants(c.id);

          const participants: ConversationParticipantModel[] = (users || []).map(u => ({
            id: `${c.id}:${u.id}`,              // fake-but-stable id for UI purposes
            conversation_id: c.id,
            user_id: u.id,
            joined_at: c.created_at.toISOString(), // fallback
            is_muted: false,                     // fallback unless you actually store per-user mute
            username: u.username,
            profile_picture_url: u.profile_picture_url
          }));

          const otherUser = !c.is_group
            ? participants.find(p => p.user_id !== me)
            : undefined;

          const displayName =
            c.is_group
              ? (c.display_name || 'Group chat')
              : (otherUser?.username || 'Direct message');

          const displayAvatar =
            c.is_group
              ? (c.group_avatar_url ||
                participants.find(p => p.profile_picture_url)?.profile_picture_url ||
                undefined)
              : (otherUser?.profile_picture_url || undefined);

          return {
            id: c.id,
            is_group: c.is_group,
            display_name: displayName,
            display_avatar: displayAvatar,
            group_avatar_url: c.group_avatar_url || undefined,
            created_at: c.created_at.toISOString(),
            updated_at: c.created_at.toISOString(),
            created_by: '',
            is_pinned: c.is_pinned,
            is_muted: c.is_muted,
            unread_count: c.unread_count,
            last_message: c.last_message ? ({
              id: '',
              conversation_id: c.id,
              sender_id: c.last_message.sender_id,
              content: c.last_message.content,
              created_at: c.last_message.created_at.toISOString(),
              updated_at: null,
              is_edited: false
            } as any) : undefined,
            participants
          };
        })
      );

      this.conversations.set(mapped);

      if (!this.initialLoadComplete()) this.initialLoadComplete.set(true);

      if (mapped.length > 0 && !this.activeConversationId()) {
        await this.selectConversation(mapped[0]);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      this.isLoadingConversations.set(false);
    }
  }

  async onSearchChange() {
    if (this.searchTerm.trim().length === 0) {
      await this.loadConversations();
      return;
    }
    
    // Simple local search
    const allConvos = await this.conversationsService.getConversations();
    const filtered = allConvos.filter(c => 
      c.display_name?.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
    
    const mapped: ConversationWithDetailsModel[] = filtered.map(c => ({
      id: c.id,
      is_group: c.is_group,
      display_name: c.display_name,
      display_avatar: c.group_avatar_url,
      group_avatar_url: c.group_avatar_url,
      created_at: c.created_at.toISOString(),
      updated_at: c.created_at.toISOString(),
      created_by: '',
      is_pinned: c.is_pinned,
      is_muted: c.is_muted,
      unread_count: c.unread_count,
      last_message: undefined,
      participants: []
    }));
    
    this.conversations.set(mapped);
  }

  private async loadMessages(conversationId: string) {
    this.isLoadingMessages.set(true);

    try {
      const { messages: msgs } = await this.messagesService.getInitialMessages(conversationId);
      this.messages.set(msgs);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      this.isLoadingMessages.set(false);
    }
  }

  private subscribeToConversation(conversationId: string) {
    console.log('[Messages] Subscribing to conversation:', conversationId);
    
    this.conversationSubscription = this.messagesService.subscribeToMessages(
      conversationId,
      async (newMessage: MessageModel) => {
        console.log('[Messages] Real-time message received:', newMessage.id);
        
        const existingIds = this.messages().map(m => m.id);
        if (existingIds.includes(newMessage.id)) {
          console.log('[Messages] Message already exists, skipping');
          return;
        }

        const sender = await this.usersService.getUserProfileById(newMessage.sender_id);
        const messageWithSender = await this.messagesService.getMessage(newMessage.id);
        if (messageWithSender) {
          // Ensure it has all required MessageModel fields
          const fullMessage: MessageModel = {
            ...messageWithSender,
            shared_rating_id: messageWithSender.shared_rating_id || null,
            reply_to_message_id: messageWithSender.reply_to_message_id || null
          } as MessageModel;

          // Resolve replied_message from existing messages
          if (fullMessage.reply_to_message_id) {
            const repliedMsg = this.messages().find(m => m.id === fullMessage.reply_to_message_id);
            if (repliedMsg) {
              fullMessage.replied_message = repliedMsg;
            }
          }

          this.messages.set([...this.messages(), fullMessage]);
        }

        if (this.activeConversationId() === conversationId) {
          await this.conversationsService.markAsRead(conversationId);
        }
      }
    );
  }

  private unsubscribeFromConversation() {
    if (this.conversationSubscription) {
      supabase.removeChannel(this.conversationSubscription);
      this.conversationSubscription = null;
    }
  }

  async onCreateChat(userIds: string[]) {
    if (!this.currentUserId() || userIds.length === 0) return;

    this.showAddChatModal = false;

    try {
      const isGroup = userIds.length > 1;
      let conversation: any;

      if (isGroup) {
        const convId = await this.conversationsService.createGroup(
          userIds,
          'New Group'
        );
        conversation = { id: convId };
      } else {
        // For DM, event.participants should have exactly 1 user
        const convId = await this.conversationsService.createDM(userIds[0]);
        conversation = { id: convId };
      }

      if (conversation) {
        await this.loadConversations();

        const newConv = this.conversations().find(c => c.id === conversation.id);
        if (newConv) {
          await this.selectConversation(newConv);
        }
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  }

  // ============================================
  // MENU ACTIONS
  // ============================================

  toggleMenu(event: MouseEvent, convId: string) {
    event.stopPropagation();
    this.openMenuId = this.openMenuId === convId ? null : convId;
  }

  async onPinConversation(event: MouseEvent, conv: ConversationWithDetailsModel) {
    event.stopPropagation();
    this.closeMenu();

    try {
      const newState = !(conv.is_pinned ?? false);
      await this.conversationsService.togglePin(conv.id, newState);

      this.conversations.update(current => {
        const updated = current.map(c => 
          c.id === conv.id ? { ...c, is_pinned: newState } : c
        );
        return updated.sort((a, b) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          return 0;
        });
      });
    } catch (error) {
      console.error('Failed to pin conversation:', error);
    }
  }

  async onMuteConversation(event: MouseEvent, conv: ConversationWithDetailsModel) {
    event.stopPropagation();
    this.closeMenu();

    try {
      const newState = !(conv.is_muted ?? false);
      await this.conversationsService.toggleMute(conv.id, newState);

      this.conversations.update(current =>
        current.map(c => 
          c.id === conv.id ? { ...c, is_muted: newState } : c
        )
      );
    } catch (error) {
      console.error('Failed to mute conversation:', error);
    }
  }

  async onDeleteConversation(event: MouseEvent, conv: ConversationWithDetailsModel) {
    event.stopPropagation();
    this.openMenuId = null;

    if (!this.currentUserId()) return;

    // Show custom modal instead of browser confirm
    this.conversationToDelete = conv;
    this.showDeleteModal = true;
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.conversationToDelete = null;
  }

  async confirmDeleteConversation() {
    if (!this.conversationToDelete) return;

    const convId = this.conversationToDelete.id;
    this.closeDeleteModal();

    try {
      await this.conversationsService.deleteConversation(convId);

      this.conversations.update(current => 
        current.filter(c => c.id !== convId)
      );

      if (this.activeConversationId() === convId) {
        this.activeConversation.set(null);
        this.activeConversationId.set(null);
        this.messages.set([]);

        const remaining = this.conversations();
        if (remaining.length > 0) {
          await this.selectConversation(remaining[0]);
        }
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  }

  // ============================================
  // LEAVE GROUP CHAT
  // ============================================

  onLeaveGroup(event: MouseEvent, conv: ConversationWithDetailsModel) {
    event.stopPropagation();
    this.openMenuId = null;

    if (!conv.is_group || !this.currentUserId()) return;

    this.conversationToLeave = conv;
    this.showLeaveGroupModal = true;
  }

  closeLeaveGroupModal() {
    this.showLeaveGroupModal = false;
    this.conversationToLeave = null;
  }

  async confirmLeaveGroup() {
    if (!this.conversationToLeave) return;
    
    const convId = this.conversationToLeave.id;
    this.closeLeaveGroupModal();
    
    try {
      // TODO: Implement leaveGroup in ConversationsService
      // For now, just delete locally
      await this.conversationsService.deleteConversation(convId);
      
      this.conversations.update(current => 
        current.filter(c => c.id !== convId)
      );
      
      if (this.activeConversationId() === convId) {
        this.activeConversation.set(null);
        this.activeConversationId.set(null);
        this.messages.set([]);
        
        const remaining = this.conversations();
        if (remaining.length > 0) {
          await this.selectConversation(remaining[0]);
        }
      }
    } catch (error) {
      console.error('Failed to leave group:', error);
    }
  }

  // ============================================
  // RECOVER DELETED CHATS
  // ============================================
  async openRecoverModal() {
    this.showRecoverModal = true;
    this.isLoadingDeletedConversations.set(true);
    
    try {
      // ✅ Use ConversationsService
      const convos = await this.conversationsService.getDeletedConversations();
      
      // Map to ConversationWithDetailsModel
      const deleted: ConversationWithDetailsModel[] = convos.map(c => ({
        id: c.id,
        is_group: c.is_group,
        display_name: c.display_name,
        display_avatar: c.group_avatar_url,
        group_avatar_url: c.group_avatar_url,
        created_at: c.created_at.toISOString(),
        updated_at: c.created_at.toISOString(),
        created_by: '',
        is_pinned: false,
        is_muted: false,
        unread_count: 0,
        last_message: undefined,
        participants: []
      }));
      
      this.deletedConversations.set(deleted);
    } catch (error) {
      console.error('Failed to load deleted conversations:', error);
    } finally {
      this.isLoadingDeletedConversations.set(false);
    }
  }

  closeRecoverModal() {
    this.showRecoverModal = false;
    this.deletedConversations.set([]);
  }

  onRecoverChat(conv: ConversationWithDetailsModel) {
    this.conversationToRecover = conv;
    this.showConfirmRecoverModal = true;
  }

  closeConfirmRecoverModal() {
    this.showConfirmRecoverModal = false;
    this.conversationToRecover = null;
  }

  async confirmRecoverChat() {
    if (!this.conversationToRecover) return;
    
    const convId = this.conversationToRecover.id;
    this.closeConfirmRecoverModal();
    
    try {
      // ✅ Use ConversationsService
      await this.conversationsService.recoverConversation(convId);
      
      // Remove from deleted list
      this.deletedConversations.update(current => 
        current.filter(c => c.id !== convId)
      );
      
      // Reload conversations to show recovered one
      await this.loadConversations();
      
      // Close recover modal if no more deleted conversations
      if (this.deletedConversations().length === 0) {
        this.closeRecoverModal();
      }
    } catch (error) {
      console.error('Failed to recover conversation:', error);
    }
  }

  // ============================================
  // EDIT GROUP CHAT
  // ============================================

  onEditGroupChat(event: MouseEvent, conv: ConversationWithDetailsModel) {
    event.stopPropagation();
    this.openMenuId = null;

    if (!conv.is_group) return;

    this.editingConversation.set(conv);
    this.editGroupName = conv.group_name || conv.display_name || '';
    this.originalGroupName = conv.group_name || conv.display_name || '';
    this.originalGroupAvatar = conv.group_avatar_url || '';
    this.editGroupAvatarPreview = null;
    this.editGroupAvatarFile = null;
    this.showEditGroupModal = true;
  }

  closeEditGroupModal() {
    this.showEditGroupModal = false;
    this.editingConversation.set(null);
    this.editGroupName = '';
    this.editGroupAvatarPreview = null;
    this.editGroupAvatarFile = null;
    this.dragCounter = 0;
    this.isDraggingOver.set(false);
  }

  hasGroupChanges(): boolean {
    const nameChanged = this.editGroupName.trim() !== this.originalGroupName;
    const avatarChanged = this.editGroupAvatarFile !== null;
    const hasValidName = this.editGroupName.trim().length >= 2 && this.editGroupName.trim().length <= 50;
    
    return (nameChanged && hasValidName) || avatarChanged;
  }

  async saveGroupChanges() {
    const conv = this.editingConversation();
    if (!conv) return;
    
    this.isSavingGroupChanges.set(true);
    
    try {
      // TODO: Implement uploadGroupAvatar and updateGroupDetails
      console.log('Save group changes:', conv.id);
      
      // Update local state
      this.conversations.update(current =>
        current.map(c => 
          c.id === conv.id 
            ? { ...c, display_name: this.editGroupName, group_avatar_url: this.editGroupAvatarPreview || c.group_avatar_url }
            : c
        )
      );
      
      this.closeEditGroupModal();
    } catch (error) {
      console.error('Failed to save group changes:', error);
    } finally {
      this.isSavingGroupChanges.set(false);
    }
  }

  // ============================================
  // DRAG AND DROP HANDLERS
  // ============================================

  onDragEnter(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragCounter++;
    if (this.dragCounter === 1) {
      this.isDraggingOver.set(true);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragCounter--;
    if (this.dragCounter === 0) {
      this.isDraggingOver.set(false);
    }
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragCounter = 0;
    this.isDraggingOver.set(false);

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    this.handleGroupAvatarFile(file);
  }

  onGroupAvatarSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.handleGroupAvatarFile(file);
    input.value = ''; // Reset input
  }

  private handleGroupAvatarFile(file: File) {
    // Validate it's an image
    if (!file.type.startsWith('image/')) {
      console.error('Please select an image file');
      return;
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      console.error('Image too large. Maximum size is 5MB.');
      return;
    }

    this.editGroupAvatarFile = file;

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      this.editGroupAvatarPreview = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  // ============================================
  // HELPERS
  // ============================================
  getConversationName(conv: ConversationWithDetailsModel): string {
    return conv.display_name || 'Loading...';
  }

  getConversationAvatar(conv: ConversationWithDetailsModel): string {
    return conv.display_avatar || '/assets/images/default-avatar.png';
  }

  getMessageSenderName(message: MessageWithSenderModel): string {
    return message.sender_username || 'Unknown';
  }

  formatMessageTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  isOwnMessage(message: MessageWithSenderModel): boolean {
    return message.sender_id === this.currentUserId();
  }


  // ===== MESSAGE EVENT HANDLERS =====
  startReply(message: MessageModel) {
    this.replyingToMessage.set(message);
    this.editingMessageId.set(null);
    setTimeout(() => {
      const input = document.querySelector('.input-area input') as HTMLInputElement;
      if (input) input.focus();
    }, 0);
  }

  cancelReply() {
    this.replyingToMessage.set(null);
  }

  startEdit(message: MessageModel) {
    this.editingMessageId.set(message.id);
    this.replyingToMessage.set(null);
    this.messageInput = message.content || '';
    setTimeout(() => {
      const input = document.querySelector('.input-area input') as HTMLInputElement;
      if (input) input.focus();
    }, 0);
  }

  cancelEdit() {
    this.editingMessageId.set(null);
    this.messageInput = '';
  }

  confirmDeleteMessage(message: MessageModel) {
    if (confirm('Delete this message?')) {
      this.deleteMessage(message.id);
    }
  }

  async deleteMessage(messageId: string) {
    try {
      await this.messagesService.deleteMessage(messageId);
      this.messages.update(current => 
        current.filter(m => m.id !== messageId)
      );
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  }

  async navigateToRating(ratingId: string) {
    // Collect all shared ratings from loaded messages
    const messagesWithRatings = this.messages().filter(m => m.shared_rating);
    if (messagesWithRatings.length === 0) return;

    const ratingIds = messagesWithRatings.map(m => m.shared_rating!.id);

    // Fetch posts for these ratings (posts table only has: id, author_id, poster_url, caption, visibility, created_at, rating_id)
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('*')
      .in('rating_id', ratingIds);

    if (postsError || !posts || posts.length === 0) return;

    const postIds = posts.map(p => p.id);
    const authorIds = [...new Set(posts.map(p => p.author_id))];

    // Batch fetch authors, like counts, and comment counts in parallel (same pattern as account component)
    const [authorsRes, likeCounts, commentCounts] = await Promise.all([
      supabase.from('users').select('*').in('id', authorIds),
      this.getLikeCountsForPosts(postIds),
      this.getCommentCountsForPosts(postIds),
    ]);

    const authorsMap = new Map<string, UserModel>(
      (authorsRes.data || []).map(a => [a.id, a as UserModel])
    );

    // Build PostWithRating list from messages that have matching posts
    const postsMap = new Map(posts.map(p => [p.rating_id, p]));
    const chatPostsList: PostWithRating[] = [];

    for (const msg of messagesWithRatings) {
      const rating = msg.shared_rating!;
      const post = postsMap.get(rating.id);
      if (!post) continue;

      const author = authorsMap.get(post.author_id);
      if (!author) continue;

      chatPostsList.push({
        post: {
          id: post.id,
          author_id: post.author_id,
          poster_url: rating.poster_url,
          caption: post.caption,
          visibility: post.visibility,
          like_count: likeCounts.get(post.id) || 0,
          save_count: 0,
          comment_count: commentCounts.get(post.id) || 0,
          tag_count: 0,
          created_at: post.created_at,
        },
        rating: rating,
        author: author,
        taggedUsers: [],
      });
    }

    if (chatPostsList.length === 0) return;

    // Find the index of the clicked rating
    const clickedIndex = chatPostsList.findIndex(p => p.rating.id === ratingId);

    this.chatPosts.set(chatPostsList);
    this.selectedPostIndex.set(clickedIndex >= 0 ? clickedIndex : 0);
    this.showPostModal.set(true);
  }

  private async getLikeCountsForPosts(postIds: string[]): Promise<Map<string, number>> {
    if (postIds.length === 0) return new Map();
    const { data } = await supabase
      .from('likes')
      .select('target_id')
      .eq('target_type', 'post')
      .in('target_id', postIds);
    const counts = new Map<string, number>();
    (data || []).forEach((like: any) => {
      counts.set(like.target_id, (counts.get(like.target_id) || 0) + 1);
    });
    return counts;
  }

  private async getCommentCountsForPosts(postIds: string[]): Promise<Map<string, number>> {
    if (postIds.length === 0) return new Map();
    const { data } = await supabase
      .from('comments')
      .select('post_id')
      .in('post_id', postIds);
    const counts = new Map<string, number>();
    (data || []).forEach((comment: any) => {
      counts.set(comment.post_id, (counts.get(comment.post_id) || 0) + 1);
    });
    return counts;
  }

  closePostModal() {
    this.showPostModal.set(false);
  }

  navigateToPreviousPost() {
    if (this.canNavigatePrevious()) {
      this.selectedPostIndex.update(i => i - 1);
    }
  }

  navigateToNextPost() {
    if (this.canNavigateNext()) {
      this.selectedPostIndex.update(i => i + 1);
    }
  }

  onModalPostUpdated(event: { index: number; likeCount: number }) {
    this.chatPosts.update(posts => {
      const updated = [...posts];
      if (updated[event.index]) {
        updated[event.index] = {
          ...updated[event.index],
          post: { ...updated[event.index].post, like_count: event.likeCount }
        };
      }
      return updated;
    });
  }

  onModalPostDeleted(event: { postId: string; ratingId: string }) {
    this.chatPosts.update(posts => posts.filter(p => p.post.id !== event.postId));
    if (this.chatPosts().length === 0) {
      this.closePostModal();
    } else if (this.selectedPostIndex() >= this.chatPosts().length) {
      this.selectedPostIndex.set(this.chatPosts().length - 1);
    }
  }

  onModalVisibilityChanged(event: { postId: string; visibility: 'public' | 'archived' }) {
    this.chatPosts.update(posts => {
      const updated = [...posts];
      const idx = updated.findIndex(p => p.post.id === event.postId);
      if (idx >= 0) {
        updated[idx] = {
          ...updated[idx],
          post: { ...updated[idx].post, visibility: event.visibility }
        };
      }
      return updated;
    });
  }

  trackByMessageId(index: number, message: MessageModel): string {
    return message.id;
  }

  // ===== FIX GET PARTICIPANT COUNT =====
  getParticipantCount(conv: ConversationWithDetailsModel): number {
    return conv.participants?.length || 0;
  }

  closeMenu() {
    this.openMenuId = null;
  }

  /**
   * ✅ Determine if avatar should be shown for this message
   */
  shouldShowAvatar(index: number): boolean {
    const msgs = this.messages();
    const currentMsg = msgs[index];

    // Always show on last message
    if (index === msgs.length - 1) {
      return true;
    }

    // Show if next message is from a different sender
    const nextMsg = msgs[index + 1];
    return currentMsg.sender_id !== nextMsg.sender_id;
  }

  onShareRating(rating: RatingModel) {
    this.shareRatingData = rating;
    this.showShareModal = true;
  }

  onShareComplete() {
    this.showShareModal = false;
    this.shareRatingData = null;
  }

  onCancelShare() {
    this.showShareModal = false;
    this.shareRatingData = null;
  }
}