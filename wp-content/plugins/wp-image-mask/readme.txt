=== WP Image Mask ===
Contributors: barb0ss
Tags: image, mask, shortcode, gutenberg
Requires at least: 6.0.1
Tested up to: 6.5.2
Requires PHP: 7.0
Stable tag: 3.1
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html

This plugin adds the ability to set a mask to Gutenberg's image block or via shortcode `[wp-image-mask]`.

== Description ==
Select custom mask for your Gutenberg image's block or add a masked image anywhere via shortcode `[wp-image-mask]`.

# Shortcode attributes:

- `src` - URL of  the image;
- `mask` - URL of the mask;
- `fit`  - how the mask should fit into the image. `cover`, `contain` (default `contain`);
- `alt` - alt text for the image.

== Installation ==
Upload the WP Image Mask plugin to your site, activate it and start using.

== Frequently Asked Questions ==
= Do I need to replace my images with some custom Gutenberg block to use image mask? =

No, this plugin attaches to the native Gutenberg image block, so no need to replace your existing images.

= Can I apply my custom image mask? =

Sure! You can select a custom image mask file or paste SVG code of your image mask.

= I don't use Gutenberg - is there any way to add an image with mask? =

Yes! You can use shortcode `[wp-image-mask src="https://url_of_your_image" mask="https://url_of_your_mask_image"]`. 

== Screenshots ==
1. Select your image (or add a new one from Gutenberg blocks).
2. Select type of image mask from the block's settings.
3. If you choosed custom image - click on the Choose mask image button to upload your custom mask.
4. Once you have selected the mask - it will apply to your image.
5. If you choosed SVG code - paste your SVG code in the textarea field.
6. Once you have pasted the code - it will apply to your image.
7. You can also apply image masks to gallery's images.

== Changelog ==
= 3.1 =
* Add the ability to select mask fit in the Gutenberg block
= 3.0 =
* Stable release. 
* Add shortcode to apply image mask. 
= 2.0 =
* Stable release. 
* Fixed issues with applying custom mask to images.
* Add the ability to paste SVG code for image mask.
= 1.0 =
* First release.


== Upgrade Notice ==
= 3.1 =
* Add the ability to select mask fit in the Gutenberg block
* Removed network level from the plugin
= 3.0 =
Add shortcode to apply image mask. 
= 2.0 =
Fixed issues with applying custom mask to images.
= 1.0 =
First release.