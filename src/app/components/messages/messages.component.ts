import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject, signal, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RealtimeChannel } from '@supabase/supabase-js';
import { UsersService } from '../../services/users.service';
import { AddChatModalComponent } from '../add-chat-modal/add-chat-modal.component';
import { MessagesService, ConversationWithDetailsModel, MessageWithSenderModel } from '../../services/messages.service';
import { supabase } from '../../core/supabase.client';
import { SidebarService } from '../../services/sidebar.service';
import { UserModel } from '../../models/database-models/user.model';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, FormsModule, AddChatModalComponent],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.css'
})
export class MessagesComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') private messagesContainer?: ElementRef;

  private messagesService = inject(MessagesService);
  private usersService = inject(UsersService);
  public sidebarService = inject(SidebarService);

  // State
  conversations = signal<ConversationWithDetailsModel[]>([]);
  activeConversation = signal<ConversationWithDetailsModel | null>(null);
  activeConversationId = signal<string | null>(null);
  messages = signal<MessageWithSenderModel[]>([]);
  public currentUser = signal<UserModel | null>(null);
  currentUserId = signal<string | null>(null);

  // UI state
  searchTerm = '';
  messageInput = '';
  showAddChatModal = false;
  isLoadingConversations = signal(false);
  isLoadingMessages = signal(false);
  
  // Track if initial page load is complete (for shimmer display)
  initialLoadComplete = signal(false);

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
        setTimeout(() => this.scrollToBottom(), 100);
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
    
    if (this.conversations().length > 0) {
      await this.selectConversation(this.conversations()[0]);
    }
  }

  ngOnDestroy() {
    this.unsubscribeFromConversation();
  }

  async loadConversations() {
    if (!this.currentUserId()) return;

    this.isLoadingConversations.set(true);

    try {
      const convs = await this.messagesService.getUserConversations(this.currentUserId()!);
      this.conversations.set(convs);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      this.isLoadingConversations.set(false);
    }
  }

  async onSearchChange() {
    if (!this.currentUserId()) return;

    if (!this.searchTerm.trim()) {
      await this.loadConversations();
      return;
    }

    this.isLoadingConversations.set(true);

    try {
      const results = await this.messagesService.searchConversations(
        this.currentUserId()!,
        this.searchTerm
      );
      this.conversations.set(results);
    } catch (error) {
      console.error('Error searching conversations:', error);
    } finally {
      this.isLoadingConversations.set(false);
    }
  }

  async selectConversation(conv: ConversationWithDetailsModel) {
    this.activeConversation.set(conv);
    this.activeConversationId.set(conv.id);
    this.openMenuId = null;

    this.unsubscribeFromConversation();

    await this.loadMessages(conv.id);
    await this.messagesService.markConversationAsRead(conv.id, this.currentUserId()!);

    this.subscribeToConversation(conv.id);

    const updatedConvs = this.conversations().map(c => 
      c.id === conv.id ? { ...c, unread_count: 0 } : c
    );
    this.conversations.set(updatedConvs);
  }

  private async loadMessages(conversationId: string) {
    this.isLoadingMessages.set(true);

    try {
      const msgs = await this.messagesService.getConversationMessages(conversationId);
      this.messages.set(msgs);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      this.isLoadingMessages.set(false);
    }
  }

  private subscribeToConversation(conversationId: string) {
    console.log('[Messages] Subscribing to conversation:', conversationId);
    
    this.conversationSubscription = this.messagesService.subscribeToConversation(
      conversationId,
      async (newMessage) => {
        console.log('[Messages] Real-time message received:', newMessage.id);
        
        const existingIds = this.messages().map(m => m.id);
        if (existingIds.includes(newMessage.id)) {
          console.log('[Messages] Message already exists, skipping');
          return;
        }

        const sender = await this.usersService.getUserProfileById(newMessage.sender_id);
        const messageWithSender: MessageWithSenderModel = {
          ...newMessage,
          sender_username: sender?.username,
          sender_avatar: sender?.profile_picture_url || '/assets/images/default-avatar.png'
        };

        this.messages.set([...this.messages(), messageWithSender]);

        if (this.activeConversationId() === conversationId) {
          await this.messagesService.markConversationAsRead(conversationId, this.currentUserId()!);
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

  async sendMessage() {
    if (!this.messageInput.trim() || !this.activeConversationId() || !this.currentUserId()) {
      return;
    }

    const content = this.messageInput.trim();
    this.messageInput = '';

    try {
      const sentMessage = await this.messagesService.sendMessage(
        this.activeConversationId()!,
        this.currentUserId()!,
        content
      );

      if (sentMessage) {
        const currentUser = await this.usersService.getCurrentUserProfile();
        const messageWithSender: MessageWithSenderModel = {
          ...sentMessage,
          sender_username: currentUser?.username,
          sender_avatar: currentUser?.profile_picture_url || '/assets/images/default-avatar.png'
        };

        const existingIds = this.messages().map(m => m.id);
        if (!existingIds.includes(sentMessage.id)) {
          this.messages.set([...this.messages(), messageWithSender]);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      this.messageInput = content;
    }
  }

  async onCreateChat(userIds: string[]) {
    if (!this.currentUserId() || userIds.length === 0) return;

    this.showAddChatModal = false;

    try {
      const isGroup = userIds.length > 1;
      const conversation = await this.messagesService.createConversation(
        this.currentUserId()!,
        userIds,
        isGroup
      );

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
    
    if (this.openMenuId === convId) {
      this.openMenuId = null;
      return;
    }
    
    this.openMenuId = convId;
    
    // Position the menu near the clicked button
    setTimeout(() => {
      const menu = document.querySelector('.conversation-menu') as HTMLElement;
      const trigger = event.target as HTMLElement;
      const triggerRect = trigger.closest('.menu-trigger')?.getBoundingClientRect();
      
      if (menu && triggerRect) {
        // Position to the left of the trigger button
        menu.style.right = `${window.innerWidth - triggerRect.left + 8}px`;
        menu.style.top = `${triggerRect.top}px`;
      }
    }, 0);
  }

  async onPinConversation(event: MouseEvent, conv: ConversationWithDetailsModel) {
    event.stopPropagation();
    this.openMenuId = null;

    if (!this.currentUserId()) return;

    const newPinnedState = await this.messagesService.togglePin(conv.id, this.currentUserId()!);
    
    // Update local state
    const updatedConvs = this.conversations().map(c => 
      c.id === conv.id ? { ...c, is_pinned: newPinnedState } : c
    );

    // Re-sort: pinned first
    updatedConvs.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    this.conversations.set(updatedConvs);
  }

  async onMuteConversation(event: MouseEvent, conv: ConversationWithDetailsModel) {
    event.stopPropagation();
    this.openMenuId = null;

    if (!this.currentUserId()) return;

    const newMutedState = await this.messagesService.toggleMute(conv.id, this.currentUserId()!);
    
    // Update local state
    const updatedConvs = this.conversations().map(c => 
      c.id === conv.id ? { ...c, is_muted: newMutedState } : c
    );
    this.conversations.set(updatedConvs);
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
    if (!this.conversationToDelete || !this.currentUserId()) return;

    const conv = this.conversationToDelete;
    this.closeDeleteModal();

    const success = await this.messagesService.deleteConversation(conv.id);
    
    if (success) {
      // Remove from local state
      const updatedConvs = this.conversations().filter(c => c.id !== conv.id);
      this.conversations.set(updatedConvs);

      // If deleted conversation was active, select the first available
      if (this.activeConversationId() === conv.id) {
        if (updatedConvs.length > 0) {
          await this.selectConversation(updatedConvs[0]);
        } else {
          this.activeConversation.set(null);
          this.activeConversationId.set(null);
          this.messages.set([]);
        }
      }
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
    if (!this.conversationToLeave || !this.currentUserId()) return;

    const convId = this.conversationToLeave.id;
    this.closeLeaveGroupModal();

    const success = await this.messagesService.leaveGroup(convId);

    if (success) {
      // Remove from local state
      const updatedConvs = this.conversations().filter(c => c.id !== convId);
      this.conversations.set(updatedConvs);

      // If left conversation was active, select the first available
      if (this.activeConversationId() === convId) {
        if (updatedConvs.length > 0) {
          await this.selectConversation(updatedConvs[0]);
        } else {
          this.activeConversation.set(null);
          this.activeConversationId.set(null);
          this.messages.set([]);
        }
      }
    }
  }

  // ============================================
  // RECOVER DELETED CHATS
  // ============================================

  async openRecoverModal() {
    this.showRecoverModal = true;
    this.isLoadingDeletedConversations.set(true);

    try {
      const deleted = await this.messagesService.getDeletedConversations(this.currentUserId()!);
      this.deletedConversations.set(deleted);
    } catch (error) {
      console.error('Error loading deleted conversations:', error);
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
    if (!this.conversationToRecover || !this.currentUserId()) return;

    const conv = this.conversationToRecover;
    this.closeConfirmRecoverModal();

    const success = await this.messagesService.undeleteConversation(conv.id);
    
    if (success) {
      // Remove from deleted list
      const updatedDeleted = this.deletedConversations().filter(c => c.id !== conv.id);
      this.deletedConversations.set(updatedDeleted);

      // Reload active conversations to include the recovered one
      await this.loadConversations();

      // If no more deleted conversations, close the modal
      if (updatedDeleted.length === 0) {
        this.closeRecoverModal();
      }
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
    this.editGroupName = conv.group_name || '';
    this.originalGroupName = conv.group_name || '';
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
      // Upload new avatar if selected
      if (this.editGroupAvatarFile) {
        const uploadResult = await this.messagesService.uploadGroupAvatar(conv.id, this.editGroupAvatarFile);
        if (!uploadResult.success) {
          console.error('Failed to upload group avatar:', uploadResult.error);
        }
      }

      // Update group name if changed
      const newName = this.editGroupName.trim();
      if (newName !== this.originalGroupName && newName.length >= 2) {
        await this.messagesService.updateGroupDetails(conv.id, { group_name: newName });
      }

      // Reload conversations to get updated data
      await this.loadConversations();

      // Update active conversation if it was the edited one
      if (this.activeConversationId() === conv.id) {
        const updatedConv = this.conversations().find(c => c.id === conv.id);
        if (updatedConv) {
          this.activeConversation.set(updatedConv);
        }
      }

      this.closeEditGroupModal();
    } catch (error) {
      console.error('Error saving group changes:', error);
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

  private scrollToBottom() {
    if (this.messagesContainer) {
      const element = this.messagesContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  getConversationName(conv: ConversationWithDetailsModel): string {
    return conv.display_name || 'Loading...';
  }

  getConversationAvatar(conv: ConversationWithDetailsModel): string {
    return conv.display_avatar || '/assets/images/default-avatar.png';
  }

  getMessageSenderName(message: MessageWithSenderModel): string {
    return message.sender_username || 'Unknown';
  }

  getParticipantCount(conv: ConversationWithDetailsModel): number {
    return conv.participant_ids.length;
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
}