import os
from shutil import rmtree, copytree, ignore_patterns, copyfile
from typing import TypedDict, List
import re
import argparse
import os
from urllib.parse import quote , unquote
from frontmatter import loads, dumps
from Pylette import extract_colors
from cleantext import clean
import logging
import json

# Configure logging
# do tabs for readability
logging.basicConfig(level=logging.DEBUG, format="%(levelname)s - [%(funcName)s] - %(message)s")
logger = logging.getLogger(__name__)
parser = argparse.ArgumentParser()


parser.add_argument(
    "--eleventy-content-dir",
    help="Directory of your eleventy content directory, the obsidian notes should be processed into.",
    type=str,
)

parser.add_argument(
    "--obsidian-vault-dir",
    help="Directory of the Obsidian vault, the notes should be processed from.",
    type=str,
)

parser.add_argument(
    "--eleventy-static-dir",
    help="Directory of your eleventy static directory, the obsidian images should be processed into.",
    type=str,
)
WikiLink = TypedDict("WikiLink", {"wiki_link": str, "link": str, "text": str})

class ObsidianToeleventy:
    """
    Process the obsidian vault and convert it to eleventy ready content.
    """

    def __init__(
        self,
        obsidian_vault_dir: str,
        eleventy_content_dir: str,
        eleventy_static_dir: str,
        filename_list = [],
        image_list = []
    ) -> None:
        self.obsidian_vault_dir = obsidian_vault_dir
        self.eleventy_content_dir = eleventy_content_dir
        self.eleventy_static_dir = eleventy_static_dir
        self.filename_list = filename_list
        self.image_list = image_list

    def run(self) -> None:
        """
        Delete the eleventy content directory and copy the obsidian vault to the
        eleventy content directory, then process the content so that the wiki links
        are replaced with the eleventy links.
        """
        self.clear_eleventy_content_dir()
        self.copy_obsidian_vault_to_eleventy_content_dir()
        self.process_content()


    def add_frontmatter(self,text: str,root,filename) -> str:
        """
        adds some frontmatter to the file
        """
        post = loads(text)
        post['layout'] = "base.njk"

            
        # use "title" to add:
        #eleventyNavigation:
        #  key: {title}
        #  parent: {parent}

        # for parent choose the parent folder of the file (if the parent folder contains a {parent}.md file})
        post['eleventyNavigation'] = {}
        
        # guard for post not having a title - auto-generate from filename
        if "title" not in post.keys():
            # Remove .md extension and use filename as title
            auto_title = filename.replace('.md', '')
            logger.warning(f"WARNING: The file {root}/{filename} does not have a title set. Using filename as title: {auto_title}")
            post['title'] = auto_title
            
        post['eleventyNavigation']['key'] = post['title']

            
        # add own path to the frontmatter
        if root == "":
            post['path'] = quote(f"/garden/{post['title']}/")
        #check if title is the same as the folder name
        elif post['title'] == os.path.basename(root):
            post['path'] = quote(f"/garden{root.replace(self.eleventy_content_dir,'')}/")
        else:
            post['path'] = quote(f"/garden{root.replace(self.eleventy_content_dir,'')}/{post['title']}/")

        # remove all emojis when using parent as filename
        parent_folder_name = clean(os.path.basename(root), lower=False, no_emoji=True)

        search_deeper = False
        deeproot = root
        # check for leafs in folder with foldername.md
        if any(f == f"{parent_folder_name}.md" for f in os.listdir(deeproot)):
            if parent_folder_name != post['title']:
                post['eleventyNavigation']['parent'] = parent_folder_name
                post['parentpath'] = f"/garden/{os.path.relpath(deeproot, self.eleventy_content_dir)}/{parent_folder_name}.md"
                
            else:
                search_deeper = True
        else:
            search_deeper = True
            name = f"{parent_folder_name}.md"
        while not any(f == f"{parent_folder_name}.md" for f in os.listdir(deeproot)) or search_deeper:
            # check if we are in the deeproot folder
            if deeproot == self.eleventy_content_dir or deeproot == os.path.dirname(self.eleventy_content_dir):
                parent_folder_name = ""
                break
            # go one folder up
            if search_deeper:
                logger.debug(f"searching deeper in {deeproot}")
                search_deeper = False
            deeproot = os.path.dirname(deeproot)
            parent_folder_name = clean(os.path.basename(deeproot), no_emoji=True,lower=False)
        if parent_folder_name == "":
            pass
        elif parent_folder_name != post['title']:
            post['eleventyNavigation']['parent'] = parent_folder_name
            post['parentpath'] = f"{deeproot}/{parent_folder_name}.md"
        
        # if there is a "banner" key in the frontmatter with a valid value, add it to the post
        if "banner" in post.keys() and post['banner'] is not None:
            # extract the colors from the copied image
            #weird filehandling here because we already replaced to wikilinks, sry for that
            banner = unquote(post['banner'].replace("![](/static/","").replace(")",""))
            colors = extract_colors(f"{self.eleventy_static_dir}/{banner}", palette_size=3)
            post['banner'] = f"/static/{banner}"
            post['herocolor0'] = int(colors[0].hsv[0]*360)
            post['herocolor1'] = int(colors[1].hsv[0]*360)
            post['herocolor2'] = int(colors[2].hsv[0]*360)
        
        # add continent and plane
        # The Notes in 🌐Worldbuilding worldbuilding are structured after {content_dir}/🌐Worldbuilding/{plane}/{continent}/..."""
        # grab for this via regex and add it to the frontmatter

        # remove the content dir from the root
        regex_root = root.replace(self.eleventy_content_dir,"")
        
        # Check for Legendhunters first (special case - not under 🌐Worldbuilding)
        legendhunters_pattern = re.compile(r"Legendhunters(/([^/]+))?")
        legendhunters_match = legendhunters_pattern.search(regex_root)
        
        # Regex pattern for extracting plane from Worldbuilding structure
        plane_pattern = re.compile(r"🌐Worldbuilding/([^/]+)")
        plane_match = plane_pattern.search(regex_root)
        
        # Regex pattern for extracting continent
        continent_pattern = re.compile(r"🌐Worldbuilding/([^/]+)/([^/]+)")
        continent_match = continent_pattern.search(regex_root)

        if legendhunters_match:
            # Legendhunters is its own plane
            post['plane'] = "Legendhunters"
            # Use subfolder as continent if available
            if legendhunters_match.group(2):
                post['continent'] = clean(legendhunters_match.group(2), no_emoji=True, lower=False)
            else:
                post['continent'] = "General"
        elif plane_match:
            # Transform to titlecase
            post['plane'] = clean(plane_match.group(1), no_emoji=True, lower=False)
        else:
            logger.warning(f"WARNING: The file {regex_root} does not have a plane set. Please set it manually in the frontmatter.")

        if not legendhunters_match:
            if continent_match:
                # Transform to titlecase
                post['continent'] = clean(continent_match.group(2), no_emoji=True, lower=False)
            else:
                logger.warning(f"WARNING: The file {regex_root} does not have a continent set. Please set it manually in the frontmatter.")


        return dumps(post)

    def add_colors(self,text: str,root) -> str:
        """
        This function adds a custom colorscheme from the frontmatter banner
        it uses the set eleventyNavigation to get the colorscheme from the parent folder if there is no banner set
        """
        # get the colors from the frontmatter
        post = loads(text)
        if "banner" in post.keys():
            # extract the colors from the copied image
            #weird filehandling here because we already replaced to wikilinks, sry for that
            banner = unquote(post['banner'].replace("![](/static/","").replace(")",""))
            logger.debug(f"extracting colors from {banner}")
            colors = extract_colors(f"src/{banner}", palette_size=3)
            post['herocolor0'] = int(colors[0].hsv[0]*360)
            post['herocolor1'] = int(colors[1].hsv[0]*360)
            post['herocolor2'] = int(colors[2].hsv[0]*360)
        else:
            logger.debug(f"adding colors from parent")
            if "parentpath" in post.keys():
                current_parent = post['parentpath']
                search_further = True
                while search_further:
                    logger.debug(f"searching deeper in {current_parent}")
                    # load the parent file
                    with open(current_parent, "r", encoding="utf-8") as f:
                        parent = f.read()
                    parent = loads(parent)
                    if "banner" in parent.keys():
                        # check for possible hero colors
                        if "herocolor0" in parent.keys():
                            post['herocolor0'] = parent['herocolor0']
                            post['herocolor1'] = parent['herocolor1']
                            post['herocolor2'] = parent['herocolor2']
                        else:
                            # extract the colors from the copied image
                            #weird filehandling here because we already replaced to wikilinks, sry for that
                            print(f"extracting colors from {parent['banner']}")
                            # it holds it like this: ![[R_BG.png]]
                            # so we need to strip ![[ ]] to get the filename
                            temp_banner = parent['banner'].replace("![[","").replace("]]","")
                            banner = unquote(temp_banner.replace("![](/static/","").replace(")",""))
                            colors = extract_colors(f"{self.eleventy_static_dir}/{banner}", palette_size=3)
                            post['herocolor0'] = int(colors[0].hsv[0]*360)
                            post['herocolor1'] = int(colors[1].hsv[0]*360)
                            post['herocolor2'] = int(colors[2].hsv[0]*360)
                            # we could save the computed to save some cpu but im too lazy
                        search_further = False
                    else:
                        if "parentpath" in parent.keys():
                            current_parent = parent['parentpath']
                            logger.debug(f"found parent {parent['parentpath']}")
                        else:  
                            search_further = False
        return dumps(post)
    def export_site_metadata(self) -> None:
        """
        Export the site metadata from the frontmatter from every page and dumps it as a json into static.
        """
        metadata = {}
        for root, dirs, files in os.walk(self.eleventy_content_dir):
            for file in files:
                if file.endswith(".md"):
                    logger.debug(f"writing to {os.path.join(root, file)}")
                    with open(os.path.join(root, file), "r", encoding="utf-8") as f:
                        content = f.read()
                    post = loads(content)
                    if "title" in post.keys():
                        metadata[post['title']] = {}
                        # dump the metadata into the dict
                        for key in post.keys():
                            metadata[post['title']][key] = post[key]
        # dump the metadata into a json file in the static folder, remember that we have emojis in the title
        with open(os.path.join(self.eleventy_static_dir, "metadata.json"), "w", encoding="utf-8") as f:
            f.write(json.dumps(metadata))




    def get_wiki_links(self,text: str) -> List[WikiLink]:
        """
        Get all wiki links from the given text and return a list of them.
        Each list item is a dictionary with the following keys:
        - wiki_link: the exact match
        - link: the extracted link
        - text: the possible extracted text
        """
        wiki_links = []
        wiki_link_regex = r"(?<!!)\[\[(.*?)\]\]"
        for match in re.finditer(wiki_link_regex, text):
            out = {
                "wiki_link": match.group(),
            }

            if "\|" in match.group(1):
                out["link"], out["text"] = match.group(1).split("\|")
            elif "|" in match.group(1):
                out["link"], out["text"] = match.group(1).split("|")
            else:
                out["link"] = match.group(1)
                out["text"] = match.group(1)

            # if the link ends with `_index` remove it
            if out["link"].endswith("_index"):
                out["link"] = out["link"][:-6]

            wiki_links.append(out)
        return wiki_links


    def wiki_link_to_eleventy_link(self,wiki_link: WikiLink, url:str) -> str:
        """
        Convert the wiki link into a eleventy link.
        """
        # need to do this weird because of fstring fucks
        wikilink = wiki_link["link"]
        link = quote(f"/garden/{url}/{wikilink}")
        link = link.replace("%5C","/")
        # since this is eleventy, if the it ends with this/is/an/example/example shorten it to this/is/an/example
        last = link.split("/")[-1]
        prelast = link.split("/")[-2]
        if last == prelast:
            link = "/".join(link.split("/")[:-1])
        eleventy_link = f'[{wiki_link["text"]}]({link})'
        return eleventy_link

    def replace_wiki_links(self,text: str) -> str:
        """
        Replace all wiki links in the given text with eleventy links.
        """
        links = self.get_wiki_links(text)
        for link in links:
            # check first if the reffereced file exists, otherwise eleventy will throw an error
            # if the file does not exist
            eleventy_link = link["text"]
            for filename in self.filename_list:
                if link["link"] == filename[1]:
                    eleventy_link = self.wiki_link_to_eleventy_link(link, filename[0])
                    text = text.replace(link["wiki_link"], eleventy_link)
                    break
            text = text.replace(link["wiki_link"], eleventy_link)
        # now replace all image links
        return text


    def get_wiki_images(self,text: str) -> List[str]:
        wiki_images = []
        wiki_image_regex = r"\!\[\[(.*?)\]\]"
        for match in re.finditer(wiki_image_regex, text):
            matched_image = match.group()
            wiki_images.append(matched_image)
        return wiki_images


    def replace_wiki_images(self,text: str) -> str:
        """
        Replace all wiki image links in the given text with eleventy image links.
        """
        # build a list of all wiki_images
        wiki_images = self.get_wiki_images(text)
        for image in wiki_images:
            logger.debug(f"found image {image}")
            # check first if the reffereced file exists, otherwise eleventy will throw an error
            # if the file does not exist
            # wikilink looks like this: ![[Arathor.png|300]]
            has_image = False
            wiki_image_name = image.replace("![[","").replace("]]","").split("|")[0]
            for image_tuple in self.image_list:
                if wiki_image_name == image_tuple[1]:
                    eleventy_image = f'![](/static/{quote(wiki_image_name)})'
                    text = text.replace(image, eleventy_image)
                    has_image = True
                    break
            if not has_image:
                logger.warning(f"WARNING: The image {image} ({wiki_image_name}) does not exist. Replacing the link with a Placeholder")
                eleventy_image = "![](/static/Placeholder.png)"
                text = text.replace(image, eleventy_image)
        return text



    def clear_eleventy_content_dir(self) -> None:
        """
        Delete the whole content directory.
        NOTE: The folder itself gets deleted and recreated.
        """
        rmtree(self.eleventy_content_dir)

    def copy_obsidian_vault_to_eleventy_content_dir(self) -> None:
        """
        Copy all files and directories from the obsidian vault to the eleventy content directory.
        """
        # copy all images to the eleventy static directory
        # first build a list of all images
        image_path_list = []
        markdown_path_list = []
        for root, dirs, files in os.walk(self.obsidian_vault_dir):
            for file in files:
                if file.endswith(".png") or file.endswith(".jpg") or file.endswith(".jpeg") or file.endswith(".gif") or file.endswith(".svg"):
                    image_path_list.append((root,file))
                if file.endswith(".md"):
                    markdown_path_list.append((root,file))
        # then copy the images to the eleventy static directory
        for image in image_path_list:
            origin = os.path.join(image[0],image[1])
            destination = os.path.join(self.eleventy_static_dir,image[1])
            logger.info(f"copying {origin}")
            logger.info(f"   to -> {destination}")
            copyfile(origin,destination)
        # also copy markdown but keep the directory structure
        for markdown in markdown_path_list:
            origin = os.path.join(markdown[0],markdown[1])
            relative_path = os.path.relpath(markdown[0], self.obsidian_vault_dir)
            destination = os.path.join(self.eleventy_content_dir, relative_path, markdown[1])
            logger.info(f"copying {origin}")
            logger.info(f"   to -> {destination}")
            # create folder if it does not exist
            os.makedirs(os.path.join(self.eleventy_content_dir, relative_path), exist_ok=True)
            copyfile(origin,destination)
            
    def process_content(self) -> None:
        """
        Looping through all files in the eleventy content directory and replace the
        wiki links of each matching file.
        """
        # Loop through all files in the eleventy content directory and build a list of all filenames.

        #traverse the content directory and build a list of all filenames
        for root, dirs, files in os.walk(self.obsidian_vault_dir):
            for file in files:
                if file.endswith(".md"):
                    # move root to content dir path because mdlinks are relative to the content directory
                    self.filename_list.append((os.path.relpath(root, self.obsidian_vault_dir),file.replace(".md", "")))
                elif file.endswith(".png") or file.endswith(".jpg") or file.endswith(".jpeg"):
                    self.image_list.append((root,file))
        for root, dirs, files in os.walk(self.eleventy_content_dir):
            for file in files:
                if file.endswith(".md"):
                    logger.info(f"copying markdown file: {os.path.join(root, file)}")
                    with open(os.path.join(root, file), "r", encoding="utf-8") as f:
                        content = f.read()
                    added = self.replace_wiki_links(content)
                    replaced = self.replace_wiki_images(added)
                    
                    replaced = self.add_frontmatter(replaced,root,file)
                    colored = self.add_colors(replaced,root)
                    with open(os.path.join(root, file), "w", encoding="utf-8") as f:
                        f.write(colored)
        # export the metadata
        self.export_site_metadata()

def main() -> None:
    """
    Main entry point of the CLI.
    """
    args = parser.parse_args()
    if not args.eleventy_content_dir or not os.path.isdir(args.eleventy_content_dir):
        parser.error("The eleventy content directory does not exist.")
    if not args.obsidian_vault_dir or not os.path.isdir(args.obsidian_vault_dir):
        parser.error("The obsidian vault directory does not exist.")
       
    obsidian_to_eleventy = ObsidianToeleventy(
        obsidian_vault_dir=args.obsidian_vault_dir,
        eleventy_content_dir=args.eleventy_content_dir,
        eleventy_static_dir=args.eleventy_static_dir,
    )
    obsidian_to_eleventy.run()


if __name__ == "__main__":
    main()


